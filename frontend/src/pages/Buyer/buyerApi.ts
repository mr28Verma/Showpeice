import type {
  Address,
  BuyerDashboardData,
  BuyerUser,
  Order,
} from './types'
import { apiAssetUrl, apiUrl } from '../../lib/api'

export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('/')) {
    return apiAssetUrl(url)
  }
  return url
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const url = apiUrl(path)
  const headers = new Headers(options.headers || {})
  headers.set('Authorization', `Bearer ${token}`)

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof Blob) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, { ...options, headers })
  const result = await response.json().catch(() => ({}))

  if (response.status === 401) {
    throw Object.assign(new Error(result.error || 'Your session has expired. Please sign in again.'), {
      status: 401,
    })
  }

  if (!response.ok) {
    throw new Error(result.error || result.message || `Request failed (${response.status})`)
  }

  return result as T
}

export const buyerApi = {
  getDashboard(token: string) {
    return request<BuyerDashboardData>('/buyer/dashboard', token)
  },

  getProfile(token: string) {
    return request<{ user: BuyerUser }>('/buyer/profile', token)
  },

  updateProfile(token: string, data: Partial<BuyerUser>) {
    return request<{ message: string; user: BuyerUser }>('/buyer/profile', token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async uploadAvatar(token: string, file: File): Promise<{ imageUrl: string }> {
    const mimeType = file.type || (/\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg')
    const response = await fetch(apiUrl('/buyer/uploads/avatar'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mimeType,
      },
      body: file,
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || typeof result.imageUrl !== 'string') {
      throw new Error(result.error || 'Avatar upload failed.')
    }
    return { imageUrl: result.imageUrl }
  },

  changePassword(token: string, currentPassword: string, newPassword: string) {
    return request<{ success: boolean; message: string }>('/buyer/profile/password', token, {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  },

  getOrders(token: string, status?: string) {
    const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''
    return request<{ orders: Order[] }>(`/buyer/orders${query}`, token)
  },

  getOrder(token: string, id: number) {
    return request<{ order: Order }>(`/buyer/orders/${id}`, token)
  },

  getAddresses(token: string) {
    return request<{ addresses: Address[] }>('/buyer/addresses', token)
  },

  createAddress(token: string, data: Omit<Address, 'id' | 'userId'>) {
    return request<{ address: Address }>('/buyer/addresses', token, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateAddress(token: string, id: number, data: Partial<Address>) {
    return request<{ address: Address }>(`/buyer/addresses/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  deleteAddress(token: string, id: number) {
    return request<{ success: boolean }>(`/buyer/addresses/${id}`, token, {
      method: 'DELETE',
    })
  },
}
