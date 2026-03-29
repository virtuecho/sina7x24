import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_ALLOWED_IMAGE_HOST_SUFFIXES,
  DEFAULT_API_TIMEOUT_MS,
  DEFAULT_AVATAR_TIMEOUT_MS,
  DEFAULT_SINA_ORIGIN
} from '../backend/core/config.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PORT = Number(process.env.PORT) || 3000;
const SINA_ORIGIN = DEFAULT_SINA_ORIGIN;
const API_TIMEOUT_MS = DEFAULT_API_TIMEOUT_MS;
const AVATAR_TIMEOUT_MS = DEFAULT_AVATAR_TIMEOUT_MS;
const ALLOWED_IMAGE_HOST_SUFFIXES = DEFAULT_ALLOWED_IMAGE_HOST_SUFFIXES;

export {
  ALLOWED_IMAGE_HOST_SUFFIXES,
  API_TIMEOUT_MS,
  AVATAR_TIMEOUT_MS,
  PORT,
  ROOT_DIR,
  SINA_ORIGIN
};
