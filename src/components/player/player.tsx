import React, { useCallback, useEffect, useRef, useState } from 'react';
import VideoPlayer, { VideoPlayerBase, VideoPlayerBaseProps } from '@enact/moonstone/VideoPlayer';
import Spotlight from '@enact/spotlight';

import BackButton from 'components/backButton';
import Button from 'components/button';
import Media, { AudioTrack, SourceTrack, StreamingType, SubtitleTrack } from 'components/media';
import Text from 'components/text';
import useButtonEffect from 'hooks/useButtonEffect';
import useStorageState from 'hooks/useStorageState';

import Settings from './settings';
import StartFrom from './startFrom';

export type PlayerProps = {
  title: string;
  description?: string;
  poster: string;
  audios?: AudioTrack[];
  sources: SourceTrack[];
  subtitles?: SubtitleTrack[];
  startTime?: number;
  timeSyncInterval?: number;
  streamingType?: StreamingType;
  onPlay?: () => void;
  onPause?: (currentTime: number) => void;
  onEnded?: (currentTime: number) => void;
  onTimeSync?: (currentTime: number) => void | Promise<void>;
} & VideoPlayerBaseProps;

const Player: React.FC<PlayerProps> = ({
  title,
  description,
  poster,
  audios,
  sources,
  subtitles,
  startTime,
  timeSyncInterval = 30,
  streamingType,
  onPlay,
  onPause,
  onEnded,
  onTimeSync,
  ...props
}) => {
  const playerRef = useRef<VideoPlayerBase>();
  const [isControlsVisible, setIsControlsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPauseByOKClickActive] = useStorageState<boolean>('is_pause_by_ok_click_active');

  const handleControlsAvailable = useCallback(({ available }: { available: boolean }) => {
    setIsControlsVisible(available);
  }, []);

  const handlePlay = useCallback(() => {
    setIsSettingsOpen(false);
    onPlay?.();
  }, [onPlay]);
  const handlePause = useCallback(
    (e) => {
      onPause?.(e.currentTime);
    },
    [onPause],
  );
  const handlePlayPause = useCallback(
    (e: KeyboardEvent) => {
      const current: any = Spotlight.getCurrent();
      if ((!current || !current.offsetHeight || !current.offsetWidth) && playerRef.current && isPauseByOKClickActive) {
        const video: any = playerRef.current.getVideoNode();
        video.playPause();
        return false;
      }
    },
    [playerRef, isPauseByOKClickActive],
  );
  const handleEnded = useCallback(
    (e) => {
      onEnded?.(e.target.currentTime);
    },
    [onEnded],
  );
  const handleTimeSync = useCallback(async () => {
    if (playerRef.current && onTimeSync) {
      const video: any = playerRef.current.getVideoNode();

      const currentTime = video['currentTime'];

      await onTimeSync(currentTime);
    }
  }, [onTimeSync, playerRef]);
  const handleLoadedMetadata = useCallback(() => {
    setIsLoaded(true);
  }, []);
  const handleSettingsOpen = useCallback(() => {
    if (playerRef.current) {
      setIsSettingsOpen(true);

      const video: any = playerRef.current.getVideoNode();
      video.pause();
    }
  }, [playerRef]);
  const handleSettingsClose = useCallback(() => {
    if (playerRef.current) {
      setIsSettingsOpen(false);

      const video: any = playerRef.current.getVideoNode();
      video.play();
    }
  }, []);
  const handlePauseButton = useCallback(() => {
    if (playerRef.current) {
      const video: any = playerRef.current.getVideoNode();
      video.pause();
    }
  }, [playerRef]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (onTimeSync) {
      intervalId = setInterval(handleTimeSync, timeSyncInterval * 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [timeSyncInterval, onTimeSync, handleTimeSync]);

  useButtonEffect('Back', handleTimeSync);
  useButtonEffect('Blue', handleSettingsOpen);
  useButtonEffect('Play', handleSettingsClose);
  useButtonEffect('Pause', handlePauseButton);
  useButtonEffect('Enter', handlePlayPause);
  useButtonEffect('ArrowUp', handleSettingsOpen);

  return (
    <>
      <Settings visible={isSettingsOpen} onClose={handleSettingsClose} player={playerRef} />
      {isControlsVisible && (
        <div className="absolute z-10 top-0 px-4 pt-2 flex items-center">
          <BackButton className="mr-2" />
          <Text>{title}</Text>
        </div>
      )}
      {isControlsVisible && <Button className="absolute z-101 bottom-8 right-10 text-white" icon="settings" onClick={handleSettingsOpen} />}
      {isLoaded && startTime! > 0 && <StartFrom startTime={startTime} player={playerRef} />}

      <VideoPlayer
        {...props}
        //@ts-expect-error
        ref={playerRef}
        locale="ru"
        poster={poster}
        title={description}
        jumpBy={15}
        onControlsAvailable={handleControlsAvailable}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        streamingType={streamingType}
        isSettingsOpen={isSettingsOpen}
        audioTracks={audios}
        sourceTracks={sources}
        subtitleTracks={subtitles}
        videoComponent={<Media />}
      />
    </>
  );
};

export default Player;
