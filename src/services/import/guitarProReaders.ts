/**
 * The Guitar Pro readers (GP3/4/5, and GPIF inside .gpx and .gp), a lazy chunk:
 * `importSongFile` loads it when such a file is opened (Big win 30).
 */
export { ByteReader } from './guitarPro/byteReader'
export { applyGuitarProSong, parseGuitarPro } from './guitarPro'
export { parseGpif } from '../gpifImport'
export { extractGpifXml } from '../gpContainers'
