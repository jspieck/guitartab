import { downloadCloudSong } from './cloudSongApi'
import { loadGtBytes } from './songImport'
import { setLoadingWheelVisible } from '../utils/editorUi'

export async function loadCloudSongById(id: string): Promise<void> {
  setLoadingWheelVisible(true)
  try {
    const buffer = await downloadCloudSong(id)
    loadGtBytes(new Uint8Array(buffer))
  } finally {
    setLoadingWheelVisible(false)
  }
}

export function getCloudSongIdFromUrl(url: string = window.location.href): string | null {
  return new URL(url).searchParams.get('song')
}
