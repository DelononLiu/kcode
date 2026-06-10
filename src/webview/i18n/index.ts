import i18n from "i18next";
import { initReactI18next } from "react-i18next";

void i18n.use(initReactI18next).init({
  resources: {
    zh: {
      translation: {
        "chat": "对话",
        "knowledge": "知识库",
        "newChat": "+ 新对话",
        "newEntry": "+ 新条目",
        "noConversations": "暂无对话",
        "noEntries": "暂无条目",
        "send": "发送",
        "cancel": "取消",
        "save": "保存",
        "delete": "删除",
        "title": "标题",
        "content": "内容",
        "welcome": "欢迎使用 KCode AI",
        "welcomeDesc": "VS Code AI 编码助手",
        "disconnected": "未连接",
        "connected": "已连接",
        "you": "你",
        "ai": "AI",
        "system": "系统",
      },
    },
    en: {
      translation: {
        "chat": "Chat",
        "knowledge": "Knowledge",
        "newChat": "+ New Chat",
        "newEntry": "+ New Entry",
        "noConversations": "No conversations yet",
        "noEntries": "No entries yet",
        "send": "Send",
        "cancel": "Cancel",
        "save": "Save",
        "delete": "Delete",
        "title": "Title",
        "content": "Content",
        "welcome": "Welcome to KCode AI",
        "welcomeDesc": "AI-powered coding assistant for VS Code",
        "disconnected": "Disconnected",
        "connected": "Connected",
        "you": "You",
        "ai": "AI",
        "system": "System",
      },
    },
  },
  lng: "zh",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
