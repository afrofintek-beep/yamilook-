export interface ChatLocation { latitude: number; longitude: number; caption: string }
export function parseChatLocation(content: string | null): ChatLocation | null {
  if (!content || content.length > 5000) return null;
  const match = content.match(/(?:^|\n)📍 https:\/\/www\.google\.com\/maps\?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\n|$)/);
  if (!match) return null;
  const latitude = Number(match[1]), longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const caption = content.replace(match[0], '\n').trim();
  if (caption.includes('https://www.google.com/maps?q=')) return null;
  return { latitude, longitude, caption };
}
export function locationMapUrl(location: ChatLocation, directions = false) {
  const point = `${location.latitude},${location.longitude}`;
  return directions ? `https://www.google.com/maps/dir/?api=1&destination=${point}` : `https://www.google.com/maps?q=${point}`;
}
