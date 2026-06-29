// Minimal structured logger (no external deps — keeps Termux install light).
// Outputs single-line JSON in production, readable text in development.

const isProd = process.env.NODE_ENV === 'production';

function emit(level, message, meta) {
  const time = new Date().toISOString();
  if (isProd) {
    process.stdout.write(JSON.stringify({ time, level, message, ...meta }) + '\n');
  } else {
    const extra = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    process.stdout.write(`[${time}] ${level.toUpperCase()} ${message}${extra}\n`);
  }
}

export const logger = {
  info: (message, meta = {}) => emit('info', message, meta),
  warn: (message, meta = {}) => emit('warn', message, meta),
  error: (message, meta = {}) => emit('error', message, meta),
};
