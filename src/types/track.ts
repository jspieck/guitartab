export interface TrackColor {
  red: number
  green: number
  blue: number
}

export interface TrackViewModel {
  id: number
  name: string
  numStrings: number
  tuning: number[]
  capo: number
  color: TrackColor
  program: number
  volume: number
  balance: number
  reverb: number
  isMuted: boolean
  isSolo: boolean
}

export interface TrackInstrumentSettings {
  instrument: string
  solo: boolean
  mute: boolean
  volume: number
  tremolo: number
  reverb: number
  chorus: number
  phaser: number
  balance: number
}

export interface TrackUpdate {
  name?: string
  numStrings?: number
  tuning?: number[]
  capo?: number
  color?: TrackColor
  program?: number | string
  volume?: number
  balance?: number
  reverb?: number
  isMuted?: boolean
  isSolo?: boolean
}