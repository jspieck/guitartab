import LZString from 'lz-string'
import Song from '../assets/js/songData'
import { audioEngine } from '../assets/js/audioEngine'

export function serializeSongToGtBytes(): Uint8Array {
  const limiter = '%%%'
  let content = ''
  content += JSON.stringify(Song.songDescription)
  content += limiter
  content += JSON.stringify(Song.measures)
  content += limiter
  content += JSON.stringify(Song.measureMeta)
  content += limiter
  content += JSON.stringify(Song.tracks)
  content += limiter
  content += JSON.stringify(Song.playBackInstrument)
  content += limiter
  content += JSON.stringify(audioEngine.noteToDrum)

  return new Uint8Array(LZString.compressToUint8Array(content))
}
