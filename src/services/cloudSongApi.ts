/**

 * Optional cloud save client for the server/ API.

 */



export interface CloudSongSummary {

  id: string

  title: string

  author: string

  createdAt: string

  updatedAt: string

  sizeBytes: number

}



export const CLOUD_API_KEY_STORAGE_KEY = 'guitartab-cloud-api-key'



function getApiBase(): string {

  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

}



function buildApiUrl(path: string): string {

  const base = getApiBase()

  return base ? `${base}${path}` : path

}



function getWriteHeaders(apiKey?: string): HeadersInit {

  const headers: HeadersInit = {}

  const key = apiKey ?? getStoredCloudApiKey()

  if (key) {

    headers['X-API-Key'] = key

  }

  return headers

}



export function isCloudApiConfigured(): boolean {

  return typeof fetch !== 'undefined'

}



export function getStoredCloudApiKey(): string {

  try {

    return localStorage.getItem(CLOUD_API_KEY_STORAGE_KEY) ?? ''

  } catch {

    return ''

  }

}



export function setStoredCloudApiKey(apiKey: string): void {

  try {

    if (apiKey.trim()) {

      localStorage.setItem(CLOUD_API_KEY_STORAGE_KEY, apiKey.trim())

    } else {

      localStorage.removeItem(CLOUD_API_KEY_STORAGE_KEY)

    }

  } catch {

    // ignore storage failures

  }

}



export function getCloudShareUrl(songId: string): string {

  const url = new URL(window.location.href)

  url.searchParams.set('song', songId)

  return url.toString()

}



export async function listCloudSongs(): Promise<CloudSongSummary[]> {

  const response = await fetch(buildApiUrl('/api/songs'))

  if (!response.ok) {

    throw new Error(`Failed to list songs (${response.status})`)

  }



  const payload = await response.json() as { songs: CloudSongSummary[] }

  return payload.songs

}



export async function uploadCloudSong(

  bytes: Uint8Array,

  options: { title?: string; author?: string; apiKey?: string } = {},

): Promise<CloudSongSummary> {

  const params = new URLSearchParams()

  if (options.title) params.set('title', options.title)

  if (options.author) params.set('author', options.author)

  const query = params.toString()



  const response = await fetch(buildApiUrl(`/api/songs${query ? `?${query}` : ''}`), {

    method: 'POST',

    headers: {

      ...getWriteHeaders(options.apiKey),

      'Content-Type': 'application/octet-stream',

    },

    body: bytes,

  })



  if (!response.ok) {

    throw new Error(`Failed to upload song (${response.status})`)

  }



  const payload = await response.json() as { song: CloudSongSummary }

  return payload.song

}



export async function updateCloudSong(

  id: string,

  bytes: Uint8Array,

  options: { title?: string; author?: string; apiKey?: string } = {},

): Promise<CloudSongSummary> {

  const params = new URLSearchParams()

  if (options.title) params.set('title', options.title)

  if (options.author) params.set('author', options.author)

  const query = params.toString()



  const response = await fetch(buildApiUrl(`/api/songs/${id}${query ? `?${query}` : ''}`), {

    method: 'PUT',

    headers: {

      ...getWriteHeaders(options.apiKey),

      'Content-Type': 'application/octet-stream',

    },

    body: bytes,

  })



  if (!response.ok) {

    throw new Error(`Failed to update song (${response.status})`)

  }



  const payload = await response.json() as { song: CloudSongSummary }

  return payload.song

}



export async function downloadCloudSong(id: string): Promise<ArrayBuffer> {

  const response = await fetch(buildApiUrl(`/api/songs/${id}/download`))

  if (!response.ok) {

    throw new Error(`Failed to download song (${response.status})`)

  }



  return response.arrayBuffer()

}



export async function deleteCloudSong(id: string, apiKey?: string): Promise<void> {

  const response = await fetch(buildApiUrl(`/api/songs/${id}`), {

    method: 'DELETE',

    headers: getWriteHeaders(apiKey),

  })



  if (!response.ok) {

    throw new Error(`Failed to delete song (${response.status})`)

  }

}


