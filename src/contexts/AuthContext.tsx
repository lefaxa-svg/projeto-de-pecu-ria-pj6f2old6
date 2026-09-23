import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { UserProfile } from '@/types/pecuaria'

interface AuthContextType {
  user: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, pass: string) => Promise<void>
  signup: (name: string, fazendaNome: string, email: string, pass: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      const r = pb.authStore.record
      return {
        id: r.id,
        email: r.email || '',
        name: r.name || 'Produtor Rural',
        fazenda_nome: r.fazenda_nome || 'Fazenda Principal',
        avatar: r.avatar,
      }
    }
    return null
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const syncUser = () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      const r = pb.authStore.record
      setUser({
        id: r.id,
        email: r.email || '',
        name: r.name || 'Produtor Rural',
        fazenda_nome: r.fazenda_nome || 'Fazenda Principal',
        avatar: r.avatar,
      })
    } else {
      setUser(null)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    syncUser()
    const unsubscribe = pb.authStore.onChange(() => {
      syncUser()
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, pass: string) => {
    setIsLoading(true)
    try {
      await pb.collection('users').authWithPassword(email, pass)
      syncUser()
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (name: string, fazendaNome: string, email: string, pass: string) => {
    setIsLoading(true)
    try {
      await pb.collection('users').create({
        email,
        password: pass,
        passwordConfirm: pass,
        name,
        fazenda_nome: fazendaNome,
      })
      await pb.collection('users').authWithPassword(email, pass)
      syncUser()
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid) {
      try {
        await pb.collection('users').authRefresh()
        syncUser()
      } catch (_) {
        pb.authStore.clear()
        setUser(null)
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
