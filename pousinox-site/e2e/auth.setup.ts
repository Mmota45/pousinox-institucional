import { test as setup } from '@playwright/test'

const SUPABASE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjU4MjUsImV4cCI6MjA4OTk0MTgyNX0.wc1CDvE0OGSGcohNSXs41kaT5qnZqlymw6GYbbZZuv4'

setup('authenticate', async ({ page }) => {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars')
  }

  // Login via Supabase REST API
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) throw new Error(`Login failed: ${res.status}`)
  const session = await res.json()

  // Navigate to app and inject session into localStorage
  await page.goto('/')
  const storageKey = `sb-vcektwtpofypsgdgdjlx-auth-token`
  await page.evaluate(({ key, data }) => {
    localStorage.setItem(key, JSON.stringify(data))
  }, {
    key: storageKey,
    data: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
      expires_in: session.expires_in,
      token_type: 'bearer',
      user: session.user,
    },
  })

  // Save authenticated state
  await page.context().storageState({ path: 'e2e/.auth/state.json' })
})
