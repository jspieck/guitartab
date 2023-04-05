// Implementation currently set to localStorage
const Settings = {
  darkMode: false,
  vexFlowIsActive: false,
  currentZoom: 1.0,
  songPlaying: false,
  pageMode: true,
  masterVolume: 0.8,
  scrollingEnabled: true,
  sequencerTrackColor: false,
  EPSILON: 0.001,
  OVERBAR_ROW_HEIGHT: 25,

  save(key: string, value: any) {
    localStorage.setItem(key, value);
  },

  load(key: string): any {
    return localStorage.getItem(key);
  },

  remove(key: string) {
    localStorage.removeItem(key);
  },
};

export default Settings;
