// Servizio Windows del collaudo: avvia i processi elencati in processi.conf (API, studio, worker), li riavvia se cadono
// e li ferma con tutto l'albero dei figli quando il servizio si ferma. Si compila e si installa con installa.ps1.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.ServiceProcess;
using System.Text;
using System.Threading;

public class MoonbrandCollaudo : ServiceBase
{
    class Voce
    {
        public string Nome, Cartella, Comando;
        public Process Proc;
        public DateTime ProssimoAvvio = DateTime.MinValue;
    }

    readonly string dir = AppDomain.CurrentDomain.BaseDirectory;
    readonly List<Voce> voci = new List<Voce>();
    readonly Dictionary<string, string> ambiente = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    Thread guardia;
    volatile bool fermo;

    public MoonbrandCollaudo() { ServiceName = "MoonbrandCollaudo"; CanStop = true; CanShutdown = true; }

    public static void Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "/console")
        {
            var s = new MoonbrandCollaudo();
            s.OnStart(null);
            Console.WriteLine("Collaudo avviato, Invio per fermare");
            Console.ReadLine();
            s.OnStop();
            return;
        }
        Run(new MoonbrandCollaudo());
    }

    void Log(string riga)
    {
        try
        {
            Directory.CreateDirectory(Path.Combine(dir, "log"));
            File.AppendAllText(Path.Combine(dir, "log", "servizio.log"),
                DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + riga + Environment.NewLine);
        }
        catch { }
    }

    void LeggiConfig()
    {
        // Righe:  env NOME=valore   oppure   nome | cartella | comando    (# commento). %VAR% si espandono.
        foreach (var grezza in File.ReadAllLines(Path.Combine(dir, "processi.conf")))
        {
            var r = grezza.Trim();
            if (r.Length == 0 || r.StartsWith("#")) continue;
            if (r.StartsWith("env "))
            {
                var kv = r.Substring(4);
                int i = kv.IndexOf('=');
                if (i > 0) ambiente[kv.Substring(0, i).Trim()] = Espandi(kv.Substring(i + 1).Trim());
                continue;
            }
            var p = r.Split(new[] { '|' }, 3);
            if (p.Length < 3) { Log("riga ignorata: " + r); continue; }
            voci.Add(new Voce { Nome = p[0].Trim(), Cartella = Espandi(p[1].Trim()), Comando = Espandi(p[2].Trim()) });
        }
    }

    // Espande prima le variabili definite con env (in ordine), poi quelle del sistema.
    string Espandi(string s)
    {
        foreach (var kv in ambiente) s = s.Replace("%" + kv.Key + "%", kv.Value);
        return Environment.ExpandEnvironmentVariables(s);
    }

    protected override void OnStart(string[] args)
    {
        fermo = false;
        voci.Clear(); ambiente.Clear();
        LeggiConfig();
        Log("servizio avviato, " + voci.Count + " processi");
        guardia = new Thread(Guardia) { IsBackground = true };
        guardia.Start();
    }

    void Guardia()
    {
        while (!fermo)
        {
            foreach (var v in voci)
            {
                if (fermo) break;
                bool vivo = false;
                try { vivo = v.Proc != null && !v.Proc.HasExited; } catch { }
                if (vivo) continue;
                if (v.Proc != null)
                {
                    int codice = -1;
                    try { codice = v.Proc.ExitCode; } catch { }
                    Log(v.Nome + " terminato (codice " + codice + "), riavvio fra 15 s");
                    try { v.Proc.Dispose(); } catch { }
                    v.Proc = null;
                    v.ProssimoAvvio = DateTime.Now.AddSeconds(15);
                }
                if (DateTime.Now >= v.ProssimoAvvio) Avvia(v);
            }
            for (int i = 0; i < 20 && !fermo; i++) Thread.Sleep(250);
        }
    }

    void Avvia(Voce v)
    {
        try
        {
            string logFile = Path.Combine(dir, "log", v.Nome + ".log");
            Directory.CreateDirectory(Path.Combine(dir, "log"));
            File.AppendAllText(logFile, Environment.NewLine + "===== " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") +
                " avvio: " + v.Comando + " =====" + Environment.NewLine);
            var psi = new ProcessStartInfo("cmd.exe", "/d /c " + v.Comando + " >> \"" + logFile + "\" 2>&1")
            {
                WorkingDirectory = v.Cartella,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            foreach (var kv in ambiente) psi.EnvironmentVariables[kv.Key] = kv.Value;
            v.Proc = Process.Start(psi);
            Log(v.Nome + " avviato, pid " + v.Proc.Id + " in " + v.Cartella);
        }
        catch (Exception e)
        {
            Log(v.Nome + " non avviato: " + e.Message);
            v.Proc = null;
            v.ProssimoAvvio = DateTime.Now.AddSeconds(30);
        }
    }

    protected override void OnStop()
    {
        fermo = true;
        if (guardia != null) guardia.Join(5000);
        foreach (var v in voci)
        {
            try
            {
                if (v.Proc != null && !v.Proc.HasExited)
                {
                    var k = Process.Start(new ProcessStartInfo("taskkill", "/F /T /PID " + v.Proc.Id)
                    { UseShellExecute = false, CreateNoWindow = true });
                    k.WaitForExit(15000);
                    Log(v.Nome + " fermato");
                }
            }
            catch (Exception e) { Log(v.Nome + " non fermato: " + e.Message); }
        }
        Log("servizio fermato");
    }

    protected override void OnShutdown() { OnStop(); }
}
