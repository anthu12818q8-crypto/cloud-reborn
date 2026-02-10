export interface Movie {
  id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  video_url: string | null;
  genre: string[] | null;
  release_year: number | null;
  duration: number | null;
  actors: string[] | null;
  director: string | null;
  imdb_rating: number | null;
  view_count: number | null;
  is_featured: boolean | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  requires_payment: boolean | null;
  payment_amount: number | null;
  payment_image_url: string | null;
  // Ad and intro skip fields
  ad_video_url: string | null;
  ad_position: string | null;
  ad_enabled: boolean | null;
  ad_show_on_load: boolean | null;
  intro_start_seconds: number | null;
  intro_end_seconds: number | null;
  // Episode fields
  has_episodes: boolean | null;
  episode_count: number | null;
}

export interface Episode {
  id: string;
  movie_id: string;
  episode_number: number;
  title: string | null;
  video_url: string;
  duration: number | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  movie_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  movie_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const GENRES = [
  'Hành động',
  'Phiêu lưu',
  'Hoạt hình',
  'Hài kịch',
  'Tội phạm',
  'Tài liệu',
  'Chính kịch',
  'Gia đình',
  'Giả tưởng',
  'Lịch sử',
  'Kinh dị',
  'Nhạc kịch',
  'Bí ẩn',
  'Lãng mạn',
  'Khoa học viễn tưởng',
  'Chiến tranh',
  'Phương Tây',
  'Thể thao',
];
