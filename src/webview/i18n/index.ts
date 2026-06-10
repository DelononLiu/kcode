import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zhPart1 from "./zh.part1";
import zhPart2 from "./zh.part2";
import zhPart3 from "./zh.part3";
import zhPart4 from "./zh.part4";
import zhPart5 from "./zh.part5";
import zhPart6 from "./zh.part6";

const zh = {
  ...zhPart1,
  ...zhPart2,
  ...zhPart3,
  ...zhPart4,
  ...zhPart5,
  ...zhPart6,
};

void i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
  },
  lng: "zh",
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
});

export default i18n;
