import {Config} from '@remotion/cli/config';
Config.setChromiumOpenGlRenderer('angle');
Config.setOverwriteOutput(true);
Config.setVideoImageFormat('jpeg');

// Keep decoding within the service memory budget on the shared VPS.
Config.setOffthreadVideoCacheSizeInBytes(64 * 1024 * 1024);
