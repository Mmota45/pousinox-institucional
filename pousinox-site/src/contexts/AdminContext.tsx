import { createContext, useContext } from 'react'

interface AdminContextType {
  ocultarValores: boolean
  toggleOcultarValores: () => void
}

export const AdminContext = createContext<AdminContextType>({
  ocultarValores: false,
  toggleOcultarValores: () => {},
})

export function useAdmin() {
  return useContext(AdminContext)
}
