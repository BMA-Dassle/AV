// Projector power: Optoma "RS232 by Telnet" (TCP 23, ASCII) or PJLink (TCP 4352). Direct use is for an on-site host;
// the cloud deployment goes through Pandora's /v2/projector/* (spec section 12).
import net from "net";
import { HttpError } from "./config";

export type DisplayConfig = { kind: "projector" | "tv"; protocol?: "optoma" | "pjlink"; ip: string; port?: number; legacyDeviceId?: number };

function tcpExchange(ip: string, port: number, payload: string, timeoutMs = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: ip, port });
    let buf = ""; let done = false;
    const finish = (fn: () => void) => { if (done) return; done = true; sock.destroy(); fn(); };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => sock.write(payload));
    sock.on("data", (d) => { buf += d.toString("latin1"); if (/\r|\n/.test(buf)) finish(() => resolve(buf.trim())); });
    sock.once("timeout", () => finish(() => (buf ? resolve(buf.trim()) : reject(new HttpError(`no reply from ${ip}:${port}`, 502)))));
    sock.once("error", (e) => finish(() => reject(new HttpError(`${ip}:${port} ${e.message}`, 502))));
    sock.once("close", () => finish(() => (buf ? resolve(buf.trim()) : reject(new HttpError(`${ip}:${port} closed the connection`, 502)))));
  });
}

// Optoma: "~XX00 1" power on, "~XX00 0" off, "~XX124 1" power state -> "OK0" | "OK1". XX = 00 addresses any projector id.
// Feedback after power on can take 6-10 s; the projector answers "P" (pass) or "F" (fail) to writes.
export const optoma = {
  power: (ip: string, port: number, on: boolean) => tcpExchange(ip, port, `~0000 ${on ? 1 : 0}\r`).catch((e) => { throw e; }),
  status: async (ip: string, port: number) => { const r = await tcpExchange(ip, port, "~00124 1\r"); return { raw: r, on: /OK1/.test(r) ? true : /OK0/.test(r) ? false : null }; },
};

// PJLink class 1, no password: "%1POWR 1" on, "%1POWR 0" off, "%1POWR ?" -> "%1POWR=0|1|2|3" (off, on, cooling, warm-up).
export const pjlink = {
  power: (ip: string, port: number, on: boolean) => tcpExchange(ip, port, `%1POWR ${on ? 1 : 0}\r`),
  status: async (ip: string, port: number) => { const r = await tcpExchange(ip, port, "%1POWR ?\r"); const m = r.match(/POWR=(\d)/); return { raw: r, on: m ? m[1] === "1" || m[1] === "3" : null }; },
};

export const projector = {
  power: (d: DisplayConfig, on: boolean) => (d.protocol === "pjlink" ? pjlink.power(d.ip, d.port || 4352, on) : optoma.power(d.ip, d.port || 23, on)),
  status: (d: DisplayConfig) => (d.protocol === "pjlink" ? pjlink.status(d.ip, d.port || 4352) : optoma.status(d.ip, d.port || 23)),
};
