import React, { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';

const imageOrigin = import.meta.env.VITE_UPLOADS_BASE_URL || new URL(
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
).origin;

export const resolveImageUrl = (value) => {
  if (!value) return '';
  try { return new URL(value, `${imageOrigin}/`).href; }
  catch { return ''; }
};

const ImageWithFallback = ({ src, alt, className = '', fallback }) => {
  const [failed, setFailed] = useState(!src);
  useEffect(() => setFailed(!src), [src]);
  if (failed) return <div aria-label={alt} className={`${className} flex items-center justify-center bg-slate-100 text-slate-400`}>{fallback || <UserRound className="h-1/2 w-1/2" />}</div>;
  return <img src={resolveImageUrl(src)} alt={alt || ''} className={className} onError={() => setFailed(true)} />;
};

export default ImageWithFallback;
