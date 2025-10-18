/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPWRITE_ENDPOINT: 'https://syd.cloud.appwrite.io/v1'
  readonly VITE_APPWRITE_PROJECT_ID: '68f2542a00381179cfb1'
  readonly VITE_APPWRITE_KEY?: string
  readonly VITE_APPWRITE_PROJECT_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}