import TelegramBot from "node-telegram-bot-api";
import "dotenv/config";
import fs from "fs";
import { GoogleTableAPI } from "./services/google/GoogleTableApi.js";
import { get } from "http";

const bot = new TelegramBot(process.env.KEY, { polling: true });
const sheet_id = process.env.SHEET_ID;

const sheet_hash = new Map();

const listeners = new Map();

function getSheetCall(name, call) {
  console.log(name, call);
  console.log(sheet_hash);
  console.log("sheet_hash", sheet_hash.get(name));
  console.log("callIndex: ", getExcelColumnIndex(call));

  console.log(sheet_hash.get(name)?.[getExcelColumnIndex(call)]);
  const sheet = sheet_hash.get(name)?.[getExcelColumnIndex(call)];
  console.log(sheet);
  if (!sheet) return null;
  return sheet;
}

function getExcelColumnIndex(columnName) {
  let index = 0;
  for (let i = 0; i < columnName.length; i++) {
    index = index * 26 + (columnName.charCodeAt(i) - 65 + 1);
  }
  return index - 1; // Віднімаємо 1, щоб отримати індекс, що починається з 0
}

async function app() {
  await GoogleTableAPI.init();

  // const sheet = await GoogleTableAPI.get(sheet_id, "Sheet1");

  bot.onText("/start", async (msg) => {
    try {
      bot.removeListener("message", listeners.get(msg.chat.id));
      listeners.delete(msg.chat.id);
      const name = msg.text?.split(" ")[1];

      if (!name) return bot.sendMessage(msg.chat.id, "Incorrect list name");

      const test_all = await GoogleTableAPI.getTable(sheet_id, name + "!A:Z");

      const tran = transpose(test_all.values);

      sheet_hash.set(name, tran);
      const values = getSheetCall(name, "B");

      if (!values) return bot.sendMessage(msg.chat.id, "No data");

      let data = convertValues(values, name);

      if (data.error) return bot.sendMessage(msg.chat.id, data.error);

      bot.sendMessage(msg.chat.id, data.text || "no text", {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: data.buttons,
          keyboard: data.keyboard,
        },
      });

      if (data.listener) {
        listener(data.listener, msg.chat.id, name);
      }
    } catch (error) {
      bot.sendMessage(msg.chat.id, error?.message, {});
      console.log(error);
    }
  });

  bot.on("callback_query", async (query) => {
    const callback_data = query.data;

    bot.removeListener("message", listeners.get(query.from.id));
    listeners.delete(query.from.id);

    const values = getSheetCall(
      callback_data.split("!")[0],
      callback_data.split("!")[1]
    );

    if (!values)
      return bot.sendMessage(query.from.id, "No object" + " " + callback_data);

    let data = convertValues(values, callback_data.split("!")[0]);

    if (data.error) return bot.sendMessage(query.from.id, data.error);

    try {
      bot.editMessageText(data.text || "no text", {
        parse_mode: "HTML",
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: data.buttons,
          keyboard: data.keyboard,
        },
      });

      if (data.listener) {
        listener(data.listener, query.from.id, callback_data.split("!")[0]);
      }
    } catch (error) {
      bot.sendMessage(query.from.id, error?.message, {});
    }
  });
}

function listener(lis, user_id, name) {
  const list = bot.on("message", async (msg) => {
    if (msg.from.id !== user_id) return;

    try {
      const values = getSheetCall(lis.split("!")[0], lis.split("!")[1]);
      if (!values) return bot.sendMessage(msg.chat.id, "No data");

      let data = convertValues(values, name);

      if (data.error) return bot.sendMessage(msg.chat.id, data.error);

      bot.sendMessage(msg.chat.id, data.text || "no text", {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: data.buttons,
          keyboard: data.keyboard,
        },
      });
    } catch (error) {
      bot.sendMessage(msg.chat.id, error?.message, {});
      console.log(error);
    }

    bot.removeListener("message", listeners.get(user_id));
    listeners.delete(user_id);
  });

  listeners.set(user_id, list);
}

function convertValues(values, name) {
  let buttons;
  let keyboard;

  let text;

  let listener;

  if (values[1]) {
    text = values[1];
  }

  if (values[2]) {
    try {
      buttons = values[2].split(/[\n&]/).map((el) => {
        const rows = el.split("|").map((el) => {
          const b = el.split(":");
          return { text: b[0], callback_data: name + "!" + b[1] };
        });
        return rows;
      });
    } catch (error) {
      return { error: "Incorrect buttons format" };
    }
  }

  if (values[3]) {
    try {
      keyboard = values[3]
        .split("\n")
        .map((el) => el.split("|").map((text) => ({ text })));
    } catch (error) {
      console.log(error);
      return { error: "Incorrect keyboard format" };
    }
  }

  if (values[4]) {
    const c = values[4];
    listener = name + "!" + c;
  }

  return { text: text, buttons, keyboard, listener };
}

function transpose(data) {
  const maxColumns = Math.max(...data.map((row) => row.length));
  const columns = Array.from({ length: maxColumns }, () => []);

  data.forEach((row) => {
    for (let i = 0; i < maxColumns; i++) {
      columns[i].push(row[i] !== undefined ? row[i] : "");
    }
  });

  return columns;
}

app();
