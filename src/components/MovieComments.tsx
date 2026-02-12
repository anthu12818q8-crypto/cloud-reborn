import { useState, useEffect } from 'react';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Comment {
  id: string;
  movie_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { full_name: string | null; email: string | null; avatar_url: string | null };
}

interface MovieCommentsProps {
  movieId: string;
}

export function MovieComments({ movieId }: MovieCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  

  const fetchComments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('movie_id', movieId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const enriched = data.map(c => ({
        ...c,
        profile: profileMap.get(c.user_id) || null,
      }));
      setComments(enriched);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchComments();
  }, [movieId]);

  const handleSubmit = async () => {
    if (!user || !newComment.trim()) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('comments').insert({
      movie_id: movieId,
      user_id: user.id,
      content: newComment.trim(),
    });

    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể gửi bình luận', variant: 'destructive' });
    } else {
      setNewComment('');
      fetchComments();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (!error) {
      setComments(prev => prev.filter(c => c.id !== commentId));
    }
  };

  const getDisplayName = (comment: Comment) => {
    if (comment.profile?.full_name) return comment.profile.full_name;
    if (comment.profile?.email) return comment.profile.email.split('@')[0];
    return 'Ẩn danh';
  };

  

  return (
    <div className="space-y-4">
      {/* Header */}
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <MessageCircle className="w-5 h-5 text-primary" />
        Bình luận ({comments.length})
      </h3>

      {/* Comment Input */}
      {user ? (
        <div className="flex gap-3">
          <UserAvatar user={user} />
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Viết bình luận..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[56px] resize-none bg-secondary/50 border-border/50 rounded-xl text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!newComment.trim() || isSubmitting}
                className="gap-2 rounded-full"
              >
                <Send className="w-3.5 h-3.5" />
                Gửi
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4 bg-secondary/30 rounded-xl">
          <a href="/auth" className="text-primary hover:underline">Đăng nhập</a> để bình luận
        </p>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-6">Chưa có bình luận nào</p>
      ) : (
        <ScrollArea className="max-h-[400px]">
            <div className="space-y-2 pr-1">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    {comment.profile?.avatar_url ? (
                      <AvatarImage src={comment.profile.avatar_url} alt={getDisplayName(comment)} />
                    ) : null}
                    <AvatarFallback className="text-xs font-bold bg-primary/20 text-primary">
                      {getDisplayName(comment).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{getDisplayName(comment)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: vi })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                  </div>
                  {user?.id === comment.user_id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(comment.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
        </ScrollArea>
      )}
    </div>
  );
}

// Small helper component for current user avatar in comment input
function UserAvatar({ user }: { user: { id: string } }) {
  const [profile, setProfile] = useState<{ avatar_url: string | null; full_name: string | null } | null>(null);

  useEffect(() => {
    supabase.from('profiles').select('avatar_url, full_name').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user.id]);

  return (
    <Avatar className="w-9 h-9 flex-shrink-0">
      {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
      <AvatarFallback className="bg-primary/20 text-primary text-sm">
        {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
      </AvatarFallback>
    </Avatar>
  );
}
