/**
 * Single active player: when a new one starts, the previous is paused.
 * Inline and global bar both register here so only one plays at a time.
 */
const AudioManager = {
  current: null,

  register(player) {
    if (this.current && this.current !== player) {
      this.current.pause();
    }
    this.current = player;
  },

  clear(player) {
    if (this.current === player) {
      this.current = null;
    }
  },
};

export default AudioManager;
