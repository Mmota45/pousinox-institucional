import { test } from '@playwright/test'

test('orcamento - lista vazia', async ({ page }) => {
  await page.goto('/admin/orcamento', { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'screenshots/orcamento-lista.png', fullPage: false })
})

test('orcamento - detalhe (read-only)', async ({ page }) => {
  await page.goto('/admin/orcamento', { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(1500)
  const firstItem = page.locator('[class*="listItem"]').first()
  await firstItem.click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'screenshots/orcamento-detalhe.png', fullPage: false })
})

test('orcamento - editor', async ({ page }) => {
  await page.goto('/admin/orcamento', { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(1500)
  const firstItem = page.locator('[class*="listItem"]').first()
  await firstItem.click()
  await page.waitForTimeout(1000)
  // Botão Editar no header do painel central (btnMini)
  const editBtn = page.locator('[class*="panelHeader"] button', { hasText: 'Editar' }).first()
  await editBtn.click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'screenshots/orcamento-editor.png', fullPage: false })

  // Ativar Proposta Comercial
  const propostaCheckbox = page.locator('text=Proposta Comercial').locator('..').locator('input[type="checkbox"]')
  if (await propostaCheckbox.isVisible()) {
    await propostaCheckbox.check()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'screenshots/orcamento-proposta.png', fullPage: false })

    // Debug: capturar HTML das seções colapsadas
    const debugInfo = await page.evaluate(() => {
      const sections = document.querySelectorAll('[class*="section"]')
      return Array.from(sections).slice(0, 20).map(s => ({
        className: s.className.slice(0, 60),
        height: s.getBoundingClientRect().height,
        innerHTML: s.innerHTML.slice(0, 200),
      }))
    })
    // Salvar debug como JSON
    const fs = await import('fs')
    fs.writeFileSync('screenshots/debug-sections.json', JSON.stringify(debugInfo, null, 2))

    // Scroll para ver seções da proposta
    await page.evaluate(() => {
      const el = document.querySelector('[class*="editorPanelBody"]')
      if (el) el.scrollTop = el.scrollHeight
    })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'screenshots/orcamento-proposta-scroll.png', fullPage: false })
  }
})

test('orcamento - editor scroll baixo', async ({ page }) => {
  await page.goto('/admin/orcamento', { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(1500)
  const firstItem = page.locator('[class*="listItem"]').first()
  await firstItem.click()
  await page.waitForTimeout(1000)
  const editBtn = page.locator('[class*="panelHeader"] button', { hasText: 'Editar' }).first()
  await editBtn.click()
  await page.waitForTimeout(1000)
  await page.evaluate(() => {
    const el = document.querySelector('[class*="editorPanelBody"]')
    if (el) el.scrollTop = el.scrollHeight
  })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'screenshots/orcamento-editor-scroll.png', fullPage: false })
})

test('orcamento - painel direito com ações', async ({ page }) => {
  await page.goto('/admin/orcamento', { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(1500)
  // Clicar no segundo item (que tem dados reais)
  const items = page.locator('[class*="listItem"]')
  const count = await items.count()
  if (count > 1) {
    await items.nth(1).click()
  } else {
    await items.first().click()
  }
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'screenshots/orcamento-acoes.png', fullPage: false })
})
