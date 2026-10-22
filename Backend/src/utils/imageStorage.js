const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const uploadRoot = path.resolve(__dirname, '../../uploads');
const signatures = [
  { extension: '.jpg', mime: 'image/jpeg', matches: (buffer) => buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer.lastIndexOf(Buffer.from([0xff, 0xd9])) > 2 },
  { extension: '.png', mime: 'image/png', matches: (buffer) => buffer.length >= 20 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && buffer.includes(Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])) },
  { extension: '.webp', mime: 'image/webp', matches: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.readUInt32LE(4) + 8 === buffer.length && buffer.toString('ascii', 8, 12) === 'WEBP' }
];

const validateImage = (file) => {
  if (!file?.buffer?.length) throw Object.assign(new Error('Vui lòng chọn một ảnh.'), { status: 400 });
  const detected = signatures.find((signature) => signature.matches(file.buffer));
  if (!detected || file.mimetype !== detected.mime) {
    throw Object.assign(new Error('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP có nội dung hợp lệ.'), { status: 415 });
  }
  return detected;
};

const stageImage = async (file, category) => {
  const detected = validateImage(file);
  const fileName = `${crypto.randomUUID()}${detected.extension}`;
  const stageDir = path.join(uploadRoot, '.staging');
  const finalDir = path.join(uploadRoot, category);
  await fs.mkdir(stageDir, { recursive: true });
  await fs.mkdir(finalDir, { recursive: true });
  const stagePath = path.join(stageDir, fileName);
  const finalPath = path.join(finalDir, fileName);
  await fs.writeFile(stagePath, file.buffer, { flag: 'wx', mode: 0o640 });
  return { stagePath, finalPath, url: `/uploads/${category}/${fileName}` };
};

const publishImage = async (image) => fs.rename(image.stagePath, image.finalPath);
const discardImage = async (image) => {
  if (!image) return;
  await Promise.all([image.stagePath, image.finalPath].map((filePath) => fs.unlink(filePath).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  })));
};

const deleteStoredImage = async (url, category) => {
  if (typeof url !== 'string' || !url.startsWith(`/uploads/${category}/`)) return;
  const name = url.slice(`/uploads/${category}/`.length);
  if (name !== path.basename(name) || !/^[\da-f-]+\.(?:jpg|png|webp)$/i.test(name)) return;
  const directory = path.resolve(uploadRoot, category);
  const filePath = path.resolve(directory, name);
  if (!filePath.startsWith(`${directory}${path.sep}`)) return;
  await fs.unlink(filePath).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
};

module.exports = { uploadRoot, validateImage, stageImage, publishImage, discardImage, deleteStoredImage };
