import express, { Router, type Request, type Response } from "express";
import { currentUser } from "./auth.js";
import { interactive } from "./browsersign.js";
import { catAsk, catConfirm } from "./cat.js";
import { addRule, chatById, deleteChat, deleteRule, getMeta, setChatState, setMeta, voteMsg, wipeCat } from "./db.js";
import { handleEntry } from "./research.js";
import { transcribe } from "./transcribe.js";

/**
 * PARKED: Ask Chief is switched off, so the app doesn't load this. Nothing here is reachable in the product and no AI
 * model is called. The engine (cat.ts, catagent.ts, catflash.ts, catbaskets.ts, views/chief.ts) is kept so it can come
 * back; to restore the API, `app.use(chiefRouter(notify))` before appRouter(). Only the tests mount it for now.
 */
export function chiefRouter(notify?: Parameters<typeof catConfirm>[2]): Router {
  const r = Router();
  const json = express.json();
  const act = (fn: (uid: number, req: Request, res: Response) => Promise<unknown> | unknown) => async (req: Request, res: Response) => {
    const uid = currentUser(req);
    if (uid === undefined) return res.status(401).json({ error: "Sign in first", redirect: "/signin" });
    try {
      res.json((await interactive(uid, () => fn(uid, req, res))) ?? { ok: true });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  };
  r.post("/api/cat/ask", json, act((uid, req) => catAsk(uid, String(req.body?.text ?? ""), { chatId: req.body?.chat ? Number(req.body.chat) : undefined, newChat: !req.body?.chat, source: "App", live: req.body?.live !== false, trade: req.body?.trade ? Number(req.body.trade) : req.body?.handle ? handleEntry(String(req.body.handle)) : undefined })));
  // A Bearer token means the user's AI agent (the MCP server) confirmed it: the trade is theirs, tagged Bot.
  r.post("/api/cat/confirm", json, act((uid, req) => catConfirm(uid, String(req.body?.id), notify, req.headers.authorization?.startsWith("Bearer ") ? "agent" : "user")));
  r.post("/api/cat/transcribe", express.json({ limit: "6mb" }), act(async (_uid, req) => {
    const audio = String(req.body?.audio ?? "");
    if (!audio || audio.length > 6_000_000) throw new Error("That recording is empty or too long. Keep it under a minute.");
    return { text: await transcribe(audio) };
  }));
  r.post("/api/cat/unpin", json, act((uid, req) => {
    const id = Number(req.body?.chat);
    const chat = id ? chatById(id, uid) : undefined;
    if (!chat) return { ok: true };
    const state = JSON.parse(chat.state || "{}") as { trade?: number };
    delete state.trade;
    setChatState(id, state);
    return { ok: true };
  }));
  r.post("/api/cat/chat/delete", json, act((uid, req) => {
    if (!deleteChat(Number(req.body?.id), uid)) throw new Error("Chat not found");
    return { ok: true };
  }));
  r.post("/api/cat/vote", json, act((uid, req) => { voteMsg(Number(req.body.msg), uid, Math.max(-1, Math.min(1, Number(req.body.vote) || 0))); }));
  r.post("/api/cat/persona", json, act((uid, req) => {
    if (!["Sharp", "Chill", "Degen"].includes(String(req.body.persona))) throw new Error("Unknown personality");
    setMeta(uid, { catPersona: req.body.persona });
    return { reload: true, toast: `Chief is ${req.body.persona} now. Limits and Guard are unchanged.` };
  }));
  r.post("/api/cat/memory", express.urlencoded({ extended: false }), json, act((uid, req) => {
    const b = req.body as Record<string, unknown>;
    const m = getMeta(uid);
    switch (b.op) {
      case "toggle": setMeta(uid, { catMemory: !m.catMemory }); return { reload: true };
      case "forget": setMeta(uid, { catForgot: [...new Set([...m.catForgot, String(b.key)])] }); return { reload: true, toast: "Forgot it" };
      case "rule": {
        const text = String(b.text ?? "").trim();
        if (text.length < 3) throw new Error("Write the rule first");
        addRule(uid, text);
        return { reload: true, toast: "Chief will remember that" };
      }
      case "delrule": deleteRule(uid, Number(b.id)); return { reload: true, toast: "Forgot it" };
      case "wipe": wipeCat(uid); setMeta(uid, { catForgot: [] }); return { reload: true, toast: "Chief forgot everything" };
      default: throw new Error("Unknown action");
    }
  }));
  r.post("/api/ask", json, act((uid, req) => catAsk(uid, String(req.body?.text ?? ""), { source: "App" })));
  r.post("/api/confirm", json, act((uid, req) => catConfirm(uid, String(req.body?.id), notify)));
  return r;
}
