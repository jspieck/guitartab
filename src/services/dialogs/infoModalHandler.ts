import { reactive } from 'vue'
import { BaseModalHandler } from './baseModalHandler'
import { Song, SongDescription } from '../../stores/song'
import { recordSongInfoEdit } from '../editor/songSettingsCommands'
import { DIALOGS } from './dialogs'

interface SongDescriptionModal extends SongDescription {
  bound: boolean
}

export class InfoModalHandler extends BaseModalHandler {
  // Filled in place on every opening: the dialog binds to this one object.
  private readonly infoModalData: SongDescriptionModal = reactive({
    title: '',
    subtitle: '',
    author: '',
    artist: '',
    album: '',
    music: '',
    copyright: '',
    writer: '',
    instructions: '',
    comments: [''],
    bound: false,
    wordsAndMusic: '',
  })

  constructor() {
    super(DIALOGS.INFO.id, DIALOGS.INFO.name)
  }

  openModal() {
    // Load current song description data
    const songDesc = Song.songDescription
    Object.assign(this.infoModalData, {
      ...songDesc,
      bound: false,
      comments: [...songDesc.comments],
    })

    this.showModal()
  }

  submitInfo(formData: SongDescriptionModal) {
    // The title and author above the tab are bound to the song; this is one undo step.
    recordSongInfoEdit(() => {
      Object.keys(formData).forEach((key) => {
        if (key !== 'bound' && formData[key as keyof SongDescription] != null) {
          if (key === 'comments') {
            Song.songDescription.comments[0] = formData.comments[0]
          } else {
            ;(Song.songDescription as unknown as Record<string, unknown>)[key] =
              formData[key as keyof SongDescription]
          }
        }
      })
    })

    this.closeModal()
  }

  getInfoData(): SongDescriptionModal {
    return this.infoModalData
  }
}
