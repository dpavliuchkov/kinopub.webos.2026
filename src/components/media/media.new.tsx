import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import cx from 'classnames';
import HLS from 'hls.js';
import forEach from 'lodash/forEach';
import uniqBy from 'lodash/uniqBy';

import useStorageState from 'hooks/useStorageState';

import { convertToVTT } from 'utils/subtitles';

export type AudioTrack = {
  name: string;
  number: string;
  lang: string;
  index: number;
  id: string;
  default?: boolean;
};

export type SourceTrack = {
  src: string;
  type: string;
  name: string;
  default?: boolean;
};

export type SubtitleTrack = {
  src: string;
  name: string;
  number: string;
  lang: string;
  shift?: number;
  forced?: boolean;
  default?: boolean;
};

export type StreamingType = 'http' | 'hls' | 'hls2' | 'hls4';

type OwnProps = {
  autoPlay?: boolean;
  audioTracks?: AudioTrack[];
  sourceTracks?: SourceTrack[];
  subtitleTracks?: SubtitleTrack[];
  streamingType?: StreamingType;
  isSettingsOpen?: boolean;
  mediaComponent?: string;
  onUpdate?: () => void;
  onAudioChange?: (audioTrack: AudioTrack) => void;
  onSourceChange?: (sourceTrack: SourceTrack) => void;
  onSubtitleChange?: (subtitleTrack: SubtitleTrack | null) => void;
};

export type MediaRef = {
  play: () => Promise<void>;
  pause: () => void;
  playPause: () => Promise<void>;
  load: () => void;
  currentTime: number;
  playbackRate: number;
  audioTracks?: AudioTrack[];
  audioTrack?: string;
  sourceTracks?: SourceTrack[];
  sourceTrack?: string;
  subtitleTracks?: SubtitleTrack[];
  subtitleTrack?: string;
  readonly duration: number;
  readonly error: boolean;
  readonly loading: boolean;
  readonly paused: boolean;
  readonly proportionLoaded: number;
  readonly proportionPlayed: number;
};

function useVideoPlayer({
  autoPlay,
  audioTracks,
  sourceTracks,
  subtitleTracks,
  streamingType,
  isSettingsOpen,
  onAudioChange,
  onSourceChange,
  onSubtitleChange,
}: OwnProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HLS | null>(null);
  const startTimeRef = useRef(0);
  const isSettingsOpenRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHLSJSActive] = useStorageState<boolean>('is_hls.js_active');
  const [currentAudioTrack, setCurrentAudioTrack] = useState<AudioTrack>(
    () => (audioTracks?.find((audioTrack) => audioTrack.default) || audioTracks?.[0])!,
  );
  const [currentSourceTrack, setCurrentSourceTrack] = useState<SourceTrack>(
    () => (sourceTracks?.find((sourceTrack) => sourceTrack.default) || sourceTracks?.[0])!,
  );
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<SubtitleTrack | null>(
    () => subtitleTracks?.find((subtitleTrack) => subtitleTrack.default) || null,
  );

  const getAudioTracks = useCallback(() => (streamingType === 'hls2' ? [] : audioTracks), [audioTracks, streamingType]);
  const getAudioTrack = useCallback(() => currentAudioTrack?.name, [currentAudioTrack]);
  const setAudioTrack = useCallback(
    (audioTrackName: string) => {
      const audioTrackIndex = audioTracks?.findIndex((audioTrack) => audioTrack.name === audioTrackName) ?? -1;
      if (audioTrackIndex !== -1) {
        const audioTrack = audioTracks![audioTrackIndex];
        setCurrentAudioTrack(audioTrack);
        onAudioChange?.(audioTrack);
      }
    },
    [audioTracks, onAudioChange],
  );
  const getSourceTracks = useCallback(() => uniqBy(sourceTracks, 'src'), [sourceTracks]);
  const getSourceTrack = useCallback(() => currentSourceTrack?.name, [currentSourceTrack]);
  const setSourceTrack = useCallback(
    (sourceTrackName: string) => {
      const sourceTrackIndex = sourceTracks?.findIndex((sourceTrack) => sourceTrack.name === sourceTrackName) ?? -1;
      if (sourceTrackIndex !== -1) {
        const sourceTrack = sourceTracks![sourceTrackIndex];
        setCurrentSourceTrack(sourceTrack);
        onSourceChange?.(sourceTrack);
      }
    },
    [sourceTracks, onSourceChange],
  );
  const getSubtitleTracks = useCallback(() => subtitleTracks, [subtitleTracks]);
  // Key selection on the unique `number`, not `name`: two same-language tracks share a name.
  const getSubtitleTrack = useCallback(() => currentSubtitleTrack?.number, [currentSubtitleTrack]);
  const setSubtitleTrack = useCallback(
    (subtitleTrackNumber?: string) => {
      const subtitleTrackIndex = subtitleTracks?.findIndex((subtitleTrack) => subtitleTrack.number === subtitleTrackNumber) ?? -1;

      const subtitleTrack = (subtitleTrackIndex !== -1 && subtitleTracks![subtitleTrackIndex]) || null;
      setCurrentSubtitleTrack(subtitleTrack);
      onSubtitleChange?.(subtitleTrack);
    },
    [subtitleTracks, onSubtitleChange],
  );

  const currentAudioTrackIndex = useMemo(
    () => audioTracks?.findIndex((audioTrack) => audioTrack.name === currentAudioTrack?.name) ?? 0,
    [audioTracks, currentAudioTrack],
  );
  const currentSrc = useMemo(() => {
    // For plain `hls`, kinopub serves a separate per-audio master playlist; the audio is
    // selected by the `master-v1aN` suffix, where N is the server's own stream index.
    // `\d+` (not `\d`) so two-digit suffixes are replaced wholesale.
    if (streamingType === 'hls' && currentSourceTrack?.src && currentAudioTrack) {
      return currentSourceTrack.src.replace(/master-v1a\d+/, `master-v1a${currentAudioTrack.index}`);
    }
    return currentSourceTrack?.src;
  }, [streamingType, currentAudioTrack, currentSourceTrack?.src]);

  const handleMediaLoaded = useCallback(() => {
    if (videoRef.current) {
      setIsLoaded(true);
      videoRef.current.removeEventListener('canplay', handleMediaLoaded);

      if (startTimeRef.current > 0) {
        videoRef.current.currentTime = startTimeRef.current;

        if (isSettingsOpenRef.current) {
          videoRef.current.pause();
        } else {
          videoRef.current.play();
        }
      } else if (autoPlay && !isSettingsOpenRef.current) {
        videoRef.current.play();
      }
    }
  }, [autoPlay]);

  useEffect(() => {
    if (videoRef.current && currentSrc) {
      if (isHLSJSActive !== false && currentSrc.includes('.m3u8') && HLS.isSupported()) {
        const hls = (hlsRef.current = new HLS({
          enableWebVTT: false,
          enableCEA708Captions: false,
        }));
        hls.attachMedia(videoRef.current);
        hls.on(HLS.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(currentSrc);
        });
      } else {
        videoRef.current.src = currentSrc;
      }

      setIsLoaded(false);
      videoRef.current.addEventListener('canplay', handleMediaLoaded);
    }

    return () => {
      if (videoRef.current) {
        if (videoRef.current.currentTime > 0) {
          // eslint-disable-next-line
          startTimeRef.current = videoRef.current.currentTime;
        }
        // eslint-disable-next-line
        videoRef.current.removeEventListener('canplay', handleMediaLoaded);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentSrc, isHLSJSActive, handleMediaLoaded]);

  useEffect(() => {
    if (isLoaded) {
      if (hlsRef.current) {
        // Match hls.js parsed tracks by a stable key (language, then name), not array
        // position - hls.js orders/filters its tracks independently of the API order.
        const hlsTracks = hlsRef.current.audioTracks || [];
        const hlsAudioTrack =
          hlsTracks.find((audioTrack) => audioTrack.lang && audioTrack.lang === currentAudioTrack?.lang) ??
          hlsTracks.find((audioTrack) => audioTrack.name === currentAudioTrack?.name) ??
          hlsTracks[currentAudioTrackIndex];

        if (hlsAudioTrack) {
          hlsRef.current.audioTrack = hlsAudioTrack.id;
        }
      } else if (videoRef.current) {
        // Do not change audio if we don't have it (mostly on HLS)
        // @ts-expect-error - audioTracks is not part of the standard lib types
        const nativeTracks: any[] = Array.from(videoRef.current.audioTracks || []);
        let targetIndex = nativeTracks.findIndex((audioTrack) => audioTrack.language && audioTrack.language === currentAudioTrack?.lang);
        if (targetIndex === -1) {
          targetIndex = currentAudioTrackIndex;
        }

        if (nativeTracks[targetIndex]) {
          forEach(nativeTracks, (audioTrack, idx: number) => {
            audioTrack.enabled = idx === targetIndex;
          });

          videoRef.current.currentTime -= 1;
        }
      }
    }
  }, [isLoaded, currentAudioTrackIndex, currentAudioTrack]);

  useEffect(() => {
    if (isLoaded) {
      if (videoRef.current) {
        // clear existing subtitles
        while (videoRef.current.firstChild) {
          // @ts-expect-error
          videoRef.current.lastChild.track.mode = 'disabled';
          videoRef.current.removeChild(videoRef.current.lastChild!);
        }

        if (currentSubtitleTrack) {
          const addSubtitleTrack = (src: string) => {
            if (videoRef.current) {
              const track = document.createElement('track');
              videoRef.current.appendChild(track);

              track.src = src;
              track.kind = 'captions';
              track.id = currentSubtitleTrack.name;
              track.label = currentSubtitleTrack.name;
              track.srclang = currentSubtitleTrack.lang;

              track.track.mode = 'showing';
            }
          };

          if (currentSubtitleTrack.src.endsWith('.srt')) {
            convertToVTT(currentSubtitleTrack.src).then(addSubtitleTrack);
          } else {
            addSubtitleTrack(currentSubtitleTrack.src);
          }
        }
      }
    }
  }, [isLoaded, currentSubtitleTrack]);

  useEffect(() => {
    isSettingsOpenRef.current = Boolean(isSettingsOpen);
  }, [isSettingsOpen]);

  return useMemo(
    () => ({
      videoRef,
      getAudioTracks,
      getAudioTrack,
      setAudioTrack,
      getSourceTracks,
      getSourceTrack,
      setSourceTrack,
      getSubtitleTracks,
      getSubtitleTrack,
      setSubtitleTrack,
    }),
    [
      videoRef,
      getAudioTracks,
      getAudioTrack,
      setAudioTrack,
      getSourceTracks,
      getSourceTrack,
      setSourceTrack,
      getSubtitleTracks,
      getSubtitleTrack,
      setSubtitleTrack,
    ],
  );
}

function useVideoPlayerApi(ref: React.ForwardedRef<MediaRef>, props: OwnProps) {
  const player = useVideoPlayer(props);
  const videoRef = player.videoRef;

  const getCurrentTime = useCallback(() => {
    if (videoRef.current) {
      return videoRef.current.currentTime;
    }
    return 0;
  }, [videoRef]);
  const setCurrentTime = useCallback(
    (currentTime: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
      }
    },
    [videoRef],
  );
  const getPlaybackRate = useCallback(() => {
    if (videoRef.current) {
      return videoRef.current.playbackRate;
    }
    return 1;
  }, [videoRef]);
  const setPlaybackRate = useCallback(
    (playbackRate: number) => {
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackRate;
      }
    },
    [videoRef],
  );
  const getPaused = useCallback(() => {
    if (videoRef.current) {
      return videoRef.current.paused;
    }
    return false;
  }, [videoRef]);
  const getDuration = useCallback(() => {
    if (videoRef.current) {
      return videoRef.current.duration;
    }
    return 0;
  }, [videoRef]);
  const getError = useCallback(() => {
    if (videoRef.current) {
      return videoRef.current.networkState === videoRef.current.NETWORK_NO_SOURCE;
    }
    return false;
  }, [videoRef]);
  const getLoading = useCallback(() => {
    if (videoRef.current) {
      // HLS-via-hls.js rarely reaches HAVE_ENOUGH_DATA on TV, which would keep moonstone's
      // `sourceUnavailable` flag latched. Clearing once playback can proceed is enough.
      return videoRef.current.readyState < videoRef.current.HAVE_CURRENT_DATA;
    }
    return true;
  }, [videoRef]);
  const getProportionLoaded = useCallback(() => {
    if (videoRef.current) {
      return (
        videoRef.current.buffered.length && videoRef.current.buffered.end(videoRef.current.buffered.length - 1) / videoRef.current.duration
      );
    }
    return 0;
  }, [videoRef]);
  const getProportionPlayed = useCallback(() => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      // Guard against NaN/Infinity duration (HLS before metadata) pinning the slider at 0.
      return duration && isFinite(duration) ? videoRef.current.currentTime / duration : 0;
    }
    return 0;
  }, [videoRef]);
  const play = useCallback(async () => {
    await videoRef.current?.play();
  }, [videoRef]);
  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, [videoRef]);
  const playPause = useCallback(async () => {
    if (getPaused()) {
      await play();
    } else {
      pause();
    }
  }, [play, pause, getPaused]);
  const load = useCallback(() => {
    videoRef.current?.load();
  }, [videoRef]);

  const api = useMemo<MediaRef>(
    () => ({
      play,
      pause,
      playPause,
      load,
      get currentTime() {
        return getCurrentTime();
      },
      set currentTime(currentTime) {
        setCurrentTime(currentTime);
      },
      get audioTracks() {
        return player.getAudioTracks();
      },
      get audioTrack() {
        return player.getAudioTrack();
      },
      set audioTrack(audioTrack) {
        player.setAudioTrack(audioTrack);
      },
      get sourceTracks() {
        return player.getSourceTracks();
      },
      get sourceTrack() {
        return player.getSourceTrack();
      },
      set sourceTrack(sourceTrack) {
        player.setSourceTrack(sourceTrack);
      },
      get subtitleTracks() {
        return player.getSubtitleTracks();
      },
      get subtitleTrack() {
        return player.getSubtitleTrack();
      },
      set subtitleTrack(subtitleTrack) {
        player.setSubtitleTrack(subtitleTrack);
      },
      get playbackRate() {
        return getPlaybackRate();
      },
      set playbackRate(playbackRate) {
        setPlaybackRate(playbackRate);
      },
      get paused() {
        return getPaused();
      },
      get duration() {
        return getDuration();
      },
      get error() {
        return getError();
      },
      get loading() {
        return getLoading();
      },
      get proportionLoaded() {
        return getProportionLoaded();
      },
      get proportionPlayed() {
        return getProportionPlayed();
      },
    }),
    [
      player,
      play,
      pause,
      playPause,
      load,
      getCurrentTime,
      setCurrentTime,
      getPlaybackRate,
      setPlaybackRate,
      getPaused,
      getDuration,
      getError,
      getLoading,
      getProportionLoaded,
      getProportionPlayed,
    ],
  );

  useImperativeHandle(ref, () => api, [api]);

  return useMemo(
    () => ({
      api,
      player,
    }),
    [api, player],
  );
}

const MEDIA_EVENTS = [
  'onAbort',
  'onCanPlay',
  'onCanPlayThrough',
  'onDurationChange',
  'onEmptied',
  'onEncrypted',
  'onEnded',
  'onError',
  'onLoadedData',
  'onLoadedMetadata',
  'onLoadStart',
  'onPause',
  'onPlay',
  'onPlaying',
  'onProgress',
  'onRateChange',
  'onSeeked',
  'onSeeking',
  'onStalled',
  'onSuspend',
  'onTimeUpdate',
  'onVolumeChange',
  'onWaiting',
] as const;

type MediaEvents = keyof typeof MEDIA_EVENTS;

export type MediaProps = OwnProps & React.HTMLAttributes<HTMLVideoElement>;

const Media = React.forwardRef<MediaRef, MediaProps>(
  (
    {
      autoPlay,
      audioTracks,
      sourceTracks,
      subtitleTracks,
      streamingType,
      isSettingsOpen,
      onUpdate,
      onAudioChange,
      onSourceChange,
      onSubtitleChange,
      className,
      mediaComponent,
      ...props
    },
    ref,
  ) => {
    const handleUpdate = useCallback(() => {
      onUpdate?.();
    }, [onUpdate]);
    const eventProps = useMemo(
      () =>
        MEDIA_EVENTS.reduce<Partial<Record<MediaEvents, Function>>>(
          (result, event) => ({
            ...result,
            [event]: (...args: any[]) => {
              handleUpdate();
              // @ts-expect-error
              props[event]?.(...args);
            },
          }),
          {},
        ),
      [props, handleUpdate],
    );
    const { player } = useVideoPlayerApi(ref, {
      autoPlay,
      audioTracks,
      sourceTracks,
      subtitleTracks,
      streamingType,
      isSettingsOpen,
      onAudioChange,
      onSourceChange,
      onSubtitleChange,
    });

    // Backstop for moonstone's timeline: React synthetic media events on an hls.js/MSE-fed
    // <video> are unreliable on webOS, which leaves moonstone's currentTime (and therefore the
    // slider + seek math) stuck at 0. Native listeners reliably drive `onUpdate` -> handleEvent.
    useEffect(() => {
      const el = player.videoRef.current;
      if (!el) {
        return;
      }

      const events = ['timeupdate', 'durationchange', 'progress', 'play', 'pause', 'seeked', 'loadedmetadata'];
      events.forEach((event) => el.addEventListener(event, handleUpdate));

      return () => {
        events.forEach((event) => el.removeEventListener(event, handleUpdate));
      };
    }, [handleUpdate, player.videoRef]);

    return <video {...props} {...eventProps} autoPlay={false} className={cx('w-screen h-screen', className)} ref={player.videoRef} />;
  },
);

export default Media;
