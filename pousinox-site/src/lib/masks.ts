export function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})/, '$1.$2.$3/$4')
    .replace(/^(\d{2})(\d{3})(\d{3})/, '$1.$2.$3')
    .replace(/^(\d{2})(\d{3})/, '$1.$2')
}

export function maskCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    .replace(/^(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')
    .replace(/^(\d{3})(\d{3})/, '$1.$2')
    .replace(/^(\d{3})/, '$1')
}

export function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/\($/, '(').replace(/-$/, '')
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

export function maskIE(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d.replace(/(\d{3})(?=\d)/g, '$1.').replace(/\.$/, '')
}

export function maskCEP(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.replace(/^(\d{5})(\d{0,3})/, '$1-$2').replace(/-$/, '')
}
