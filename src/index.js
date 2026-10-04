// ============================================================================
// MatchMaker — Cloudflare Workers edition (grammY + webhook + D1 database)
// Deploys from GitHub via GitHub Actions (see .github/workflows/deploy.yml).
// NOTE: Cloudflare Workers is serverless (no long-polling, no persistent
// process). This is a Workers-native reimplementation of the Python bot's
// core flows: bilingual registration, discovery, like/pass, mutual match,
// relay chat, block/unmatch, deactivation, deletion.
// ============================================================================
import { Bot, webhookCallback, InlineKeyboard } from "grammy";

// ---------- i18n (English + Burmese, centralized) ---------------------------
const T = {
  en: {
    welcome: "👋 Welcome to <b>MatchMaker</b>! Let's set up your profile.",
    choose_lang: "🌐 Choose your language / ဘာသာစကားရွေးပါ",
    ask_name: "What display name should others see? (2–40 characters)",
    name_invalid: "Please enter a valid name (2–40 characters).",
    ask_age: "How old are you? (18+ only)",
    age_invalid: "Please enter a valid age as a number.",
    age_under18: "⛔ This service is strictly for adults 18+. Registration cancelled.",
    age_notice: "ℹ️ Age is self-reported. Report suspected minors via the 🚩 button on any profile.",
    ask_gender: "What is your gender?",
    g_male: "👨 Male", g_female: "👩 Female", g_other: "🧑 Other",
    ask_pref: "Who would you like to meet?",
    everyone: "💞 Everyone",
    ask_city: "Which city do you live in?",
    ask_bio: "Write a short bio (max 300 characters).",
    ask_photo: "📷 Send one profile photo.",
    consent: "🔐 <b>Privacy & Consent</b>\n\nYour profile will be visible to other users for matching. Messages are relayed through this bot (not end-to-end encrypted). You can deactivate or delete anytime via /settings.\n\nDo you consent to publishing your profile?",
    consent_yes: "✅ I Consent",
    no: "❌ No",
    consent_no: "Understood. Your profile was not published. /start to register anytime.",
    reg_done: "🎉 Your profile is live! Use /discover to start meeting people.",
    card: "<b>{name}</b>, {age} · 📍 {city}\n\n{bio}",
    like: "❤️ Like", pass: "👎 Pass", report: "🚩 Report", block: "⛔ Block",
    no_profiles: "😴 No more profiles right now. Check back later!",
    match_notify: "🎉 <b>It's a match!</b> You and {name} liked each other. Use /matches to chat.",
    matches_empty: "No matches yet. Keep discovering with /discover!",
    chat_started: "💬 Relay chat with {name} started. Messages pass through this bot under our moderation policy (not end-to-end encrypted). /stopchat to end.",
    chat_stopped: "Chat session ended.",
    chat_none: "No active chat. Pick a match with /matches first.",
    peer_gone: "⚠️ This match is no longer available.",
    unmatched: "💔 Match removed.",
    blocked_ok: "⛔ User blocked. They can no longer see or contact you.",
    report_sent: "✅ Report noted. For serious issues use /report with details.",
    settings: "⚙️ Settings",
    deactivate: "⏸️ Deactivate profile",
    activate: "▶️ Reactivate profile",
    deactivated: "Your profile is now hidden. Reactivate in /settings.",
    activated: "Welcome back! Your profile is visible again.",
    delete_btn: "🗑️ Delete account",
    delete_confirm: "⚠️ Permanently delete your account and personal data? This cannot be undone.",
    yes: "✅ Yes",
    deleted: "Your account and personal data have been deleted. Goodbye 👋",
    banned: "⛔ Your account has been suspended.",
    help: "❓ <b>Commands</b>\n/start · /discover · /matches · /profile\n/settings · /stopchat · /report · /id · /help",
    menu: "Choose an option:",
  },
  my: {
    welcome: "👋 <b>MatchMaker</b> မှ ကြိုဆိုပါသည်! သင့်ပရိုဖိုင် စတင်ဖန်တီးကြရအောင်။",
    choose_lang: "🌐 Choose your language / ဘာသာစကားရွေးပါ",
    ask_name: "အခြားသူများမြင်ရမည့် အမည် ရိုက်ထည့်ပါ (၂–၄၀ လုံး)",
    name_invalid: "မှန်ကန်သော အမည် ရိုက်ထည့်ပါ (၂–၄၀ လုံး)။",
    ask_age: "အသက်အရွယ် ရိုက်ထည့်ပါ (၁၈ နှစ်နှင့်အထက်သာ)",
    age_invalid: "ဂဏန်းဖြင့် မှန်ကန်သော အသက် ရိုက်ထည့်ပါ။",
    age_under18: "⛔ ဤဝန်ဆောင်မှုသည် အသက် ၁၈ နှစ်နှင့်အထက်များအတွက်သာ ဖြစ်သည်။",
    age_notice: "ℹ️ အသက်အရွယ်သည် ကိုယ်တိုင်ဖြည့်စွက်ခြင်း ဖြစ်သည်။",
    ask_gender: "သင့်ကျားမ အမျိုးအစားကို ရွေးချယ်ပါ။",
    g_male: "👨 အမျိုးသား", g_female: "👩ျိုးသမီး", g_other: "🧑 အခြား",
    ask_pref: "မည်သူ့ကို တွေ့ဆုံလိုပါသလဲ။",
    everyone: "💞 အားလုံး",
    ask_city: "သင်နေထိုင်ရာမြို့ကို ရိုက်ထည့်ပါ။",
    ask_bio: "မိမိအကြောင်း အကျဉ်းချုပ် ရေးပါ (လုံး ၃၀၀ အထိ)။",
    ask_photo: "📷 ပရိုဖိုင်ဓာတ်ပုံ တစ်ပုံ ပေးပို့ပါ။",
    consent: "🔐 <b>ကိုယ်ရေးကိုယ်တာနှင့် သဘောတူညီချက်</b>\n\nသင့်ပရိုဖိုင်ကို တွဲဖက်ရှာဖွေရန် အခြားအသုံးပြုသူများအား ပြသပါမည်။ မက်ဆေ့ချ်များကို bot မှတစ်ဆင့် ပို့ဆောင်ပေးသည် (end-to-end encrypted မဟုတ်ပါ)။ /settings ဖြင့် အချိန်မရွေး ပိတ်/ဖျက်နိုင်သည်။\n\nသဘောတူပါသလား။",
    consent_yes: "✅ သဘောတူသည်",
    no: "❌ မဟုတ်ပါ",
    consent_no: "နားလည်ပါပြီ။ ပရိုဖိုင် မထုတ်ဖော်ပါ။ /start ဖြင့် ပြန်စတင်နိုင်သည်။",
    reg_done: "🎉 သင့်ပရိုဖိုင် အသက်ဝင်ပါပြီ! /discover ဖြင့် စတင်ရှာဖွေပါ။",
    card: "<b>{name}</b>, {age} · 📍 {city}\n\n{bio}",
    like: "❤️ နှစ်သက်", pass: "👎 ကျော်", report: "🚩 တိုင်ကြား", block: "⛔ ပိတ်ဆို့",
    no_profiles: "😴 လောလောဆယ် ပရိုဖိုင် မရှိသေးပါ။ နောက်မှ ပြန်စစ်ပါ!",
    match_notify: "🎉 <b>တွဲဖက်တွေ့ပါပြီ!</b> သင်နှင့် {name} အချင်းချင်းှစ်သက်ကြပါတယ်။ /matches ဖြင့် စကားပြောနိုင်ပါပြီ။",
    matches_empty: "တွဲဖက် မရှိသေးပါ။ /discover ဖြင့် ဆက်ရှာပါ!",
    chat_started: "💬 {name} နှင့် စကားပြောခြင်း စတင်ပါပြီ။ မက်ဆေ့ချ်များကို bot မှတစ်ဆင့် ပို့ဆောင်သည် (end-to-end encrypted မဟုတ်ပါ)။ ရပ်ရန် /stopchat။",
    chat_stopped: "စကားပြောခြင်း ပြီးဆုံးပါပြီ။",
    chat_none: "စကားပြောခန်း မရှိပါ။ /matches ဖြင့် တွဲဖက်တစ်ဦး အရင်ရွေးပါ။",
    peer_gone: "⚠️ ဤတွဲဖက် မရရှိနိုင်တော့ပါ။",
    unmatched: "💔 တွဲဖက် ဖျက်လိုက်ပါပြီ။",
    blocked_ok: "⛔ ပိတ်ဆို့လိုက်ပါပြီ။ ၎င်းက သင့်ကို မမြင်/မဆက်သွယ်နိုင်တော့ပါ။",
    report_sent: "✅ မှတ်သားပြီးပါပြီ။",
    settings: "⚙️ ဆက်တင်များ",
    deactivate: "⏸️ ပရိုဖိုင် ခဏပိတ်",
    activate: "▶️ ပရိုဖိုင် ပြန်ဖွင့်",
    deactivated: "သင့်ပရိုဖိုင်ကို ဖျောက်ထားပါပြီ။ /settings တွင် ပြန်ဖွင့်နိုင်သည်။",
    activated: "ပြန်လည်ကြိုဆိုပါတယ်! ပရိုဖိုင် ပြန်မြင်ရပါပြီ။",
    delete_btn: "🗑️ အကောင့် ဖျက်",
    delete_confirm: "⚠️ သင့်အကောင့်နှင့် အချက်အလက်များ အပြီးအပိုင် ဖျက်မည်။ ပြန်ရ၍ မရပါ။",
    yes: "✅ ဟုတ်ကဲ့",
    deleted: "သင့်အကောင့်နှင့် အချက်အလက်များ ဖျက်လိုက်ပါပြီ။ နောင်တွေ့မည် 👋",
    banned: "⛔ သင့်အကောင့်ကို ဆိုင်းငံ့ထားပါသည်။",
    help: "❓ <b>အမိန့်များ</b>\n/start · /discover · /matches · /profile\n/settings · /stopchat · /report · /id · /help",
    menu: "ရွေးချယ်စရာတစ်ခု ရွေးပါ:",
  },
};
function t(lang, key, vars = {}) {
  let s = (T[lang] && T[lang][key]) || T.en[key] || key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll("{" + k + "}", String(v));
  return s;
}
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- D1 data layer ----------------------------------------------------
async function getUser(env, tgId, username) {
  let u = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(tgId).first();
  if (!u) {
    await env.DB.prepare(
      "INSERT INTO users(id, username, lang, state, data, is_registered, is_active, is_banned, active_match, last_active) VALUES(?,?, 'en', NULL, NULL, 0, 1, 0, NULL, ?)"
    ).bind(tgId, (username || "").slice(0, 64), new Date().toISOString()).run();
    u = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(tgId).first();
  } else {
    await env.DB.prepare("UPDATE users SET last_active=? WHERE id=?")
      .bind(new Date().toISOString(), tgId).run();
  }
  return u;
}
const setState = (env, id, state, data) =>
  env.DB.prepare("UPDATE users SET state=?, data=? WHERE id=?")
    .bind(state, data ? JSON.stringify(data) : null, id).run();
const getProfile = (env, id) =>
  env.DB.prepare("SELECT * FROM profiles WHERE user_id=?").bind(id).first();

async function nextCandidate(env, me, myProfile) {
  return env.DB.prepare(`
    SELECT p.* FROM profiles p JOIN users u ON u.id = p.user_id
    WHERE p.user_id != ? AND u.is_registered=1 AND u.is_active=1 AND u.is_banned=0
      AND p.age BETWEEN ? AND ?
      AND (? = 'everyone' OR p.gender = ?)
      AND (p.pref_gender = 'everyone' OR p.pref_gender = ?)
      AND ? BETWEEN p.min_age AND p.max_age
      AND NOT EXISTS (SELECT 1 FROM likes l WHERE l.from_user=? AND l.to_user=p.user_id)
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker=? AND b.blocked=p.user_id) OR (b.blocker=p.user_id AND b.blocked=?))
      AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.is_active=1 AND ((m.user_a=? AND m.user_b=p.user_id) OR (m.user_b=? AND m.user_a=p.user_id)))
    ORDER BY u.last_active DESC LIMIT 1`)
    .bind(me.id, myProfile.min_age, myProfile.max_age,
      myProfile.pref_gender, myProfile.pref_gender,
      myProfile.gender, myProfile.age,
      me.id, me.id, me.id, me.id, me.id)
    .first();
}

async function swipe(env, fromId, toId, kind) {
  if (fromId === toId) return { matched: false };
  const exists = await env.DB.prepare(
    "SELECT 1 AS x FROM likes WHERE from_user=? AND to_user=?").bind(fromId, toId).first();
  if (exists) return { matched: false, duplicate: true };
  await env.DB.prepare(
    "INSERT INTO likes(from_user,to_user,kind,created_at) VALUES(?,?,?,?)")
    .bind(fromId, toId, kind, new Date().toISOString()).run();
  if (kind === "pass") return { matched: false };
  const recip = await env.DB.prepare(
    "SELECT 1 AS x FROM likes WHERE from_user=? AND to_user=? AND kind='like'").bind(toId, fromId).first();
  if (!recip) return { matched: false };
  const [a, b] = fromId < toId ? [fromId, toId] : [toId, fromId];
  await env.DB.prepare(
    "INSERT INTO matches(user_a,user_b,is_active,created_at) VALUES(?,?,1,?) " +
    "ON CONFLICT(user_a,user_b) DO UPDATE SET is_active=1")
    .bind(a, b, new Date().toISOString()).run();
  return { matched: true };
}

// ---------- Bot construction --------------------------------------------------
function createBot(env) {
  const bot = new Bot(env.BOT_TOKEN);

  const langKb = () => new InlineKeyboard()
    .text("English 🇬🇧", "lang:en").text("မြန်မာ 🇲🇲", "lang:my");
  const yesNo = (l, prefix) => new InlineKeyboard()
    .text(t(l, "yes"), `${prefix}:yes`).text(t(l, "no"), `${prefix}:no`);
  const genderKb = (l, prefix, everyoneBtn) => {
    const kb = new InlineKeyboard()
      .text(t(l, "g_male"), `${prefix}:male`).text(t(l, "g_female"), `${prefix}:female`)
      .text(t(l, "g_other"), `${prefix}:other`);
    if (everyoneBtn) kb.row().text(t(l, "everyone"), `${prefix}:everyone`);
    return kb;
  };
  const swipeKb = (l, target) => new InlineKeyboard()
    .text(t(l, "like"), `swipe:like:${target}`).text(t(l, "pass"), `swipe:pass:${target}`)
    .row().text(t(l, "report"), `report:${target}`).text(t(l, "block"), `block:${target}`);

  async function sendCard(ctx, chatId, profile, lang, kb) {
    const caption = t(lang, "card", { name: esc(profile.name), age: profile.age, city: esc(profile.city), bio: esc(profile.bio) });
    if (profile.photo) {
      await ctx.api.sendPhoto(chatId, profile.photo, { caption, parse_mode: "HTML", reply_markup: kb });
    } else {
      await ctx.api.sendMessage(chatId, caption, { parse_mode: "HTML", reply_markup: kb });
    }
  }

  async function showNext(ctx, userId, lang) {
    const me = await getUser(env, userId);
    const myProfile = await getProfile(env, userId);
    if (!myProfile) return;
    const cand = await nextCandidate(env, me, myProfile);
    if (!cand) { await ctx.api.sendMessage(userId, t(lang, "no_profiles")); return; }
    await sendCard(ctx, userId, cand, lang, swipeKb(lang, cand.user_id));
  }

  // --- commands ---------------------------------------------------------------
  bot.command("id", async (ctx) => {
    await ctx.reply(`🆔 Your Telegram ID: <code>${ctx.from.id}</code>`, { parse_mode: "HTML" });
  });

  bot.command("start", async (ctx) => {
    const u = await getUser(env, ctx.from.id, ctx.from.username);
    if (u.is_banned) return ctx.reply(t(u.lang, "banned"));
    await setState(env, ctx.from.id, null, null);
    if (u.is_registered) return ctx.reply(t(u.lang, "menu"));
    await ctx.reply(t(u.lang, "welcome"), { parse_mode: "HTML" });
    await ctx.reply(t(u.lang, "choose_lang"), { reply_markup: langKb() });
  });

  bot.command("help", async (ctx) => {
    const u = await getUser(env, ctx.from.id);
    await ctx.reply(t(u.lang, "help"), { parse_mode: "HTML" });
  });

  bot.command("discover", async (ctx) => {
    const u = await getUser(env, ctx.from.id);
    if (u.is_banned) return ctx.reply(t(u.lang, "banned"));
    if (!u.is_registered) return ctx.reply(t(u.lang, "welcome"), { parse_mode: "HTML" });
    await showNext(ctx, ctx.from.id, u.lang);
  });

  bot.command("profile", async (ctx) => {
    const u = await getUser(env, ctx.from.id);
    const p = await getProfile(env, ctx.from.id);
    if (!p) return ctx.reply(t(u.lang, "welcome"), { parse_mode: "HTML" });
    await sendCard(ctx, ctx.chat.id, p, u.lang, null);
  });

  bot.command("matches", async (ctx) => {
    const u = await getUser(env, ctx.from.id);
    const rows = await env.DB.prepare(
      "SELECT m.*, p.name AS peer_name, p.user_id AS peer_id FROM matches m " +
      "JOIN profiles p ON p.user_id = CASE WHEN m.user_a=? THEN m.user_b ELSE m.user_a END " +
      "WHERE m.is_active=1 AND (m.user_a=? OR m.user_b=?) LIMIT 20")
      .bind(ctx.from.id, ctx.from.id, ctx.from.id).all();
    if (!rows.results.length) return ctx.reply(t(u.lang, "matches_empty"));
    const kb = new InlineKeyboard();
    for (const m of rows.results) {
      kb.text(`💬 ${m.peer_name}`, `chat:${m.id}`).text("💔", `unmatch:${m.id}`).row();
    }
    await ctx.reply(t(u.lang, "menu"), { reply_markup: kb });
  });

  bot.command("stopchat", async (ctx) => {
    const u = await getUser(env, ctx.from.id);
    if (!u.active_match) return ctx.reply(t(u.lang, "chat_none"));
    await env.DB.prepare("UPDATE users SET active_match=NULL WHERE id=?").bind(ctx.from.id).run();
    await ctx.reply(t(u.lang, "chat_stopped"));
  });

  bot.command("settings", async (ctx) => {
    const u = await getUser(env, ctx.from.id);
    if (!u.is_registered) return ctx.reply(t(u.lang, "welcome"), { parse_mode: "HTML" });
    const kb = new InlineKeyboard()
      .text(u.is_active ? t(u.lang, "deactivate") : t(u.lang, "activate"), "set:toggle").row()
      .text(t(u.lang, "delete_btn"), "del:ask");
    await ctx.reply(t(u.lang, "settings"), { reply_markup: kb });
  });

  // --- callbacks ---------------------------------------------------------------
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const [action, a1, a2] = data.split(":");
    const u = await getUser(env, ctx.from.id);
    const l = u.lang;
    await ctx.answerCallbackQuery().catch(() => {});

    if (action === "lang" && ["en", "my"].includes(a1)) {
      await env.DB.prepare("UPDATE users SET lang=? WHERE id=?").bind(a1, ctx.from.id).run();
      if (u.is_registered) return ctx.reply(t(a1, "menu"));
      await setState(env, ctx.from.id, "reg:name", {});
      return ctx.reply(t(a1, "ask_name"));
    }
    if (action === "g" && ["male", "female", "other"].includes(a1) && u.state === "reg:gender") {
      const d = JSON.parse(u.data || "{}"); d.gender = a1;
      await setState(env, ctx.from.id, "reg:pref", d);
      return ctx.reply(t(l, "ask_pref"), { reply_markup: genderKb(l, "pg", true) });
    }
    if (action === "pg" && ["male", "female", "other", "everyone"].includes(a1) && u.state === "reg:pref") {
      const d = JSON.parse(u.data || "{}"); d.pref_gender = a1;
      await setState(env, ctx.from.id, "reg:city", d);
      return ctx.reply(t(l, "ask_city"));
    }
    if (action === "consent" && u.state === "reg:consent") {
      if (a1 === "no") {
        await setState(env, ctx.from.id, null, null);
        return ctx.reply(t(l, "consent_no"));
      }
      const d = JSON.parse(u.data || "{}");
      await env.DB.prepare(
        "INSERT INTO profiles(user_id,name,age,gender,pref_gender,city,bio,photo,min_age,max_age) VALUES(?,?,?,?,?,?,?,?,18,99) " +
        "ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,age=excluded.age,gender=excluded.gender," +
        "pref_gender=excluded.pref_gender,city=excluded.city,bio=excluded.bio,photo=excluded.photo")
        .bind(ctx.from.id, d.name, d.age, d.gender, d.pref_gender, d.city, d.bio, d.photo || null).run();
      await env.DB.prepare("UPDATE users SET is_registered=1, is_active=1, state=NULL, data=NULL WHERE id=?")
        .bind(ctx.from.id).run();
      return ctx.reply(t(l, "reg_done"));
    }
    if (action === "swipe") {
      const target = parseInt(a2, 10);
      if (!target || target === ctx.from.id) return;
      const kind = a1 === "pass" ? "pass" : "like";
      const res = await swipe(env, ctx.from.id, target, kind);
      if (res.matched) {
        const [mine, theirs] = await Promise.all([getProfile(env, ctx.from.id), getProfile(env, target)]);
        const peer = await env.DB.prepare("SELECT lang FROM users WHERE id=?").bind(target).first();
        await ctx.api.sendMessage(ctx.from.id, t(l, "match_notify", { name: esc(theirs?.name || "?") }), { parse_mode: "HTML" }).catch(() => {});
        await ctx.api.sendMessage(target, t(peer?.lang || "en", "match_notify", { name: esc(mine?.name || "?") }), { parse_mode: "HTML" }).catch(() => {});
      }
      await ctx.deleteMessage().catch(() => {});
      return showNext(ctx, ctx.from.id, l);
    }
    if (action === "block") {
      const target = parseInt(a1, 10);
      if (!target || target === ctx.from.id) return;
      await env.DB.prepare("INSERT OR IGNORE INTO blocks(blocker,blocked) VALUES(?,?)")
        .bind(ctx.from.id, target).run();
      const [a, b] = ctx.from.id < target ? [ctx.from.id, target] : [target, ctx.from.id];
      await env.DB.prepare("UPDATE matches SET is_active=0 WHERE user_a=? AND user_b=?").bind(a, b).run();
      await env.DB.prepare("UPDATE users SET active_match=NULL WHERE id=?").bind(ctx.from.id).run();
      await ctx.deleteMessage().catch(() => {});
      return ctx.reply(t(l, "blocked_ok"));
    }
    if (action === "report") {
      return ctx.reply(t(l, "report_sent"));
    }
    if (action === "chat") {
      const m = await env.DB.prepare(
        "SELECT * FROM matches WHERE id=? AND is_active=1 AND (user_a=? OR user_b=?)")
        .bind(parseInt(a1, 10), ctx.from.id, ctx.from.id).first();
      if (!m) return ctx.reply(t(l, "peer_gone"));
      await env.DB.prepare("UPDATE users SET active_match=? WHERE id=?").bind(m.id, ctx.from.id).run();
      const peerId = m.user_a === ctx.from.id ? m.user_b : m.user_a;
      const peer = await getProfile(env, peerId);
      return ctx.reply(t(l, "chat_started", { name: esc(peer?.name || "?") }));
    }
    if (action === "unmatch") {
      const m = await env.DB.prepare(
        "SELECT * FROM matches WHERE id=? AND is_active=1 AND (user_a=? OR user_b=?)")
        .bind(parseInt(a1, 10), ctx.from.id, ctx.from.id).first();
      if (!m) return ctx.reply(t(l, "peer_gone"));
      await env.DB.prepare("UPDATE matches SET is_active=0 WHERE id=?").bind(m.id).run();
      await env.DB.prepare("UPDATE users SET active_match=NULL WHERE active_match=?").bind(m.id).run();
      return ctx.reply(t(l, "unmatched"));
    }
    if (action === "set" && a1 === "toggle") {
      await env.DB.prepare("UPDATE users SET is_active = 1 - is_active WHERE id=?").bind(ctx.from.id).run();
      const nu = await env.DB.prepare("SELECT is_active FROM users WHERE id=?").bind(ctx.from.id).first();
      return ctx.reply(t(l, nu.is_active ? "activated" : "deactivated"));
    }
    if (action === "del" && a1 === "ask") {
      return ctx.reply(t(l, "delete_confirm"), { reply_markup: yesNo(l, "delyes") });
    }
    if (action === "delyes") {
      if (a1 === "no") return;
      await env.DB.batch([
        env.DB.prepare("DELETE FROM profiles WHERE user_id=?").bind(ctx.from.id),
        env.DB.prepare("DELETE FROM likes WHERE from_user=? OR to_user=?").bind(ctx.from.id, ctx.from.id),
        env.DB.prepare("DELETE FROM blocks WHERE blocker=? OR blocked=?").bind(ctx.from.id, ctx.from.id),
        env.DB.prepare("UPDATE matches SET is_active=0 WHERE user_a=? OR user_b=?").bind(ctx.from.id, ctx.from.id),
        env.DB.prepare("UPDATE users SET is_registered=0, is_active=0, state=NULL, data=NULL, active_match=NULL WHERE id=?").bind(ctx.from.id),
      ]);
      return ctx.reply(t(l, "deleted"));
    }
  });

  // --- messages: registration steps + chat relay --------------------------------
  bot.on("message", async (ctx) => {
    if (ctx.from.is_bot) return;
    const u = await getUser(env, ctx.from.id, ctx.from.username);
    const l = u.lang;
    if (u.is_banned) return ctx.reply(t(l, "banned"));
    const d = JSON.parse(u.data || "{}");

    if (u.state === "reg:name") {
      const name = (ctx.message.text || "").trim();
      if (name.length < 2 || name.length > 40) return ctx.reply(t(l, "name_invalid"));
      d.name = name;
      await setState(env, ctx.from.id, "reg:age", d);
      return ctx.reply(t(l, "ask_age"));
    }
    if (u.state === "reg:age") {
      const age = parseInt((ctx.message.text || "").trim(), 10);
      if (isNaN(age)) return ctx.reply(t(l, "age_invalid"));
      if (age < 18) { await setState(env, ctx.from.id, null, null); return ctx.reply(t(l, "age_under18")); }
      if (age > 120) return ctx.reply(t(l, "age_invalid"));
      d.age = age;
      await setState(env, ctx.from.id, "reg:gender", d);
      await ctx.reply(t(l, "age_notice"));
      return ctx.reply(t(l, "ask_gender"), { reply_markup: genderKb(l, "g", false) });
    }
    if (u.state === "reg:city") {
      const city = (ctx.message.text || "").trim().slice(0, 80);
      if (city.length < 2) return ctx.reply(t(l, "ask_city"));
      d.city = city;
      await setState(env, ctx.from.id, "reg:bio", d);
      return ctx.reply(t(l, "ask_bio"));
    }
    if (u.state === "reg:bio") {
      d.bio = (ctx.message.text || "").trim().slice(0, 300);
      await setState(env, ctx.from.id, "reg:photo", d);
      return ctx.reply(t(l, "ask_photo"));
    }
    if (u.state === "reg:photo") {
      if (!ctx.message.photo) return ctx.reply(t(l, "ask_photo"));
      d.photo = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      await setState(env, ctx.from.id, "reg:consent", d);
      return ctx.reply(t(l, "consent"), { parse_mode: "HTML", reply_markup: yesNo(l, "consent") });
    }
    if (u.state) return; // other states handled via callbacks

    // --- relay chat ---
    if (!u.is_registered) return ctx.reply(t(l, "welcome"), { parse_mode: "HTML" });
    if (!u.active_match) return ctx.reply(t(l, "menu"));
    const m = await env.DB.prepare(
      "SELECT * FROM matches WHERE id=? AND is_active=1 AND (user_a=? OR user_b=?)")
      .bind(u.active_match, ctx.from.id, ctx.from.id).first();
    if (!m) {
      await env.DB.prepare("UPDATE users SET active_match=NULL WHERE id=?").bind(ctx.from.id).run();
      return ctx.reply(t(l, "peer_gone"));
    }
    const peerId = m.user_a === ctx.from.id ? m.user_b : m.user_a;
    const blocked = await env.DB.prepare(
      "SELECT 1 AS x FROM blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)")
      .bind(ctx.from.id, peerId, peerId, ctx.from.id).first();
    if (blocked) {
      await env.DB.prepare("UPDATE users SET active_match=NULL WHERE id=?").bind(ctx.from.id).run();
      return ctx.reply(t(l, "peer_gone"));
    }
    try {
      await ctx.api.copyMessage(peerId, ctx.chat.id, ctx.message.message_id);
    } catch {
      await ctx.reply(t(l, "peer_gone"));
    }
  });

  return bot;
}

// ---------- Worker entry --------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    // One-time webhook registration: GET /register?key=WEBHOOK_SECRET
    if (url.pathname === "/register") {
      if (url.searchParams.get("key") !== env.WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const webhookUrl = `${url.origin}/webhook/${env.WEBHOOK_SECRET}`;
      const res = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: webhookUrl, secret_token: env.WEBHOOK_SECRET }),
        }
      );
      return Response.json(await res.json());
    }

    // Telegram webhook endpoint — secret in the path AND header verified.
    if (url.pathname === `/webhook/${env.WEBHOOK_SECRET}` && request.method === "POST") {
      const header = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (header !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
      const bot = createBot(env);
      const handle = webhookCallback(bot, "cloudflare-mod");
      return handle(request);
    }

    return new Response("not found", { status: 404 });
  },
};
