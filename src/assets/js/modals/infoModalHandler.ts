import { BaseModalHandler } from './baseModalHandler';
import { Song, SongDescription } from '../songData';
import { MODALS } from './modalTypes';

interface SongDescriptionModal extends SongDescription {
    bound: boolean;
}

export class InfoModalHandler extends BaseModalHandler {
    private infoModalData: SongDescriptionModal = {
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
    };

    constructor() {
        super(MODALS.INFO.id, MODALS.INFO.name);
    }

    openModal() {
        // Load current song description data
        const songDesc = Song.songDescription;
        this.infoModalData = {
            ...songDesc,
            bound: false,
            comments: [...songDesc.comments], // Deep copy array
        };
        
        this.showModal();
    }

    protected setupModalContent(): void {
        // Vue component handles the setup
    }

    submitInfo(formData: SongDescriptionModal) {
        // Update song description with form data
        Object.keys(formData).forEach((key) => {
            if (key !== 'bound' && formData[key as keyof SongDescription] != null) {
                if (key === 'comments') {
                    Song.songDescription.comments[0] = formData.comments[0];
                } else {
                    (Song.songDescription[key as keyof SongDescription] as any) = formData[key as keyof SongDescription];
                }
            }
        });

        // Update UI elements
        document.getElementById("tabTitle")!.textContent = Song.songDescription.title;
        document.getElementById("tabAuthor")!.textContent = Song.songDescription.author;

        this.closeModal();
    }

    getInfoData(): SongDescriptionModal {
        return this.infoModalData;
    }
}