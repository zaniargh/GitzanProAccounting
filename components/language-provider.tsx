"use client"
import { createContext, useContext, useState, ReactNode } from "react"
import fa from "@/locales/fa.json"
import en from "@/locales/en.json"

type Language = "fa" | "en"

const LanguageContext = createContext<{
  lang: Language
  setLang: (l: Language) => void
  t: (key: string) => string
}>({
  lang: "fa",
  setLang: () => { },
  t: (key) => key,
})

export function useLang() {
  return useContext(LanguageContext)
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("en")
  const translations = lang === "fa" ? fa : en

  const t = (key: string) => translations[key] || key

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}
