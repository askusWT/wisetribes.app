module.exports = {
  async rewrites() {
    return {
      beforeFiles: [{ source: '/', destination: '/board.html' }]
    };
  }
};
