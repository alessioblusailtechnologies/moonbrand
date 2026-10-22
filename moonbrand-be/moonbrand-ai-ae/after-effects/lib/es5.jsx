// Funzioni ES5 mancanti in ExtendScript (tipi in lib/es5.d.ts).
if (!Array.prototype.forEach) Array.prototype.forEach = function (fn) { for (var i = 0; i < this.length; i++) fn(this[i], i, this); };
if (!Array.prototype.map) Array.prototype.map = function (fn) { var r = []; for (var i = 0; i < this.length; i++) r.push(fn(this[i], i, this)); return r; };
if (!Array.prototype.filter) Array.prototype.filter = function (fn) { var r = []; for (var i = 0; i < this.length; i++) if (fn(this[i], i, this)) r.push(this[i]); return r; };
if (!Array.prototype.some) Array.prototype.some = function (fn) { for (var i = 0; i < this.length; i++) if (fn(this[i], i, this)) return true; return false; };
if (!Array.prototype.every) Array.prototype.every = function (fn) { for (var i = 0; i < this.length; i++) if (!fn(this[i], i, this)) return false; return true; };
if (!Array.prototype.reduce) Array.prototype.reduce = function (fn, acc) { for (var i = 0; i < this.length; i++) acc = fn(acc, this[i], i, this); return acc; };
if (!Array.prototype.indexOf) Array.prototype.indexOf = function (v, from) { for (var i = from || 0; i < this.length; i++) if (this[i] === v) return i; return -1; };
if (!Array.isArray) Array.isArray = function (v) { return v instanceof Array; };
if (!String.prototype.trim) String.prototype.trim = function () { return this.replace(/^\s+|\s+$/g, ""); };
if (!Object.keys) Object.keys = function (o) { var r = []; for (var k in o) if (o.hasOwnProperty(k)) r.push(k); return r; };
if (typeof JSON === "undefined") {
  JSON = {
    parse: function (s) { return eval("(" + s + ")"); },
    stringify: function stringify(v) {
      if (v === null || v === undefined) return "null";
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      if (typeof v === "string") return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
      if (v instanceof Array) { var a = []; for (var i = 0; i < v.length; i++) a.push(stringify(v[i])); return "[" + a.join(",") + "]"; }
      var p = []; for (var k in v) if (v.hasOwnProperty(k) && typeof v[k] !== "function" && v[k] !== undefined) p.push(stringify(k) + ":" + stringify(v[k]));
      return "{" + p.join(",") + "}";
    }
  };
}
