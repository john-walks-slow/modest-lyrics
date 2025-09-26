import data from '../temp-json/The_Lonesome_Crowded_West_final.json'
import { saveFinalAlbumResults } from './io';
import { FinalAlbum } from './types';

saveFinalAlbumResults(data as FinalAlbum)