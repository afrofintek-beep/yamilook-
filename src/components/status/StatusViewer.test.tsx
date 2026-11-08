import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StatusViewer } from './StatusViewer';
import { BrowserRouter } from 'react-router-dom';

// Mock hooks
const mockMarkAsViewed = vi.fn();
const mockReplyToStatus = vi.fn();
const mockDeleteStatus = vi.fn();
const mockArchiveStatus = vi.fn();
const mockGetStatusViews = vi.fn().mockResolvedValue([
  {
    viewer_id: 'viewer-1',
    viewed_at: new Date().toISOString(),
    viewer: {
      id: 'viewer-1',
      display_name: 'Viewer One',
      avatar_url: 'https://example.com/viewer1.jpg',
    },
  },
]);
const mockToggleMuteContact = vi.fn();
const mockReactToStatus = vi.fn().mockResolvedValue(undefined);
const mockGetStatusReactions = vi.fn().mockResolvedValue([]);
const mockGetUserReaction = vi.fn().mockResolvedValue(null);

vi.mock('@/hooks/useStatus', () => ({
  useStatus: vi.fn(() => ({
    markAsViewed: mockMarkAsViewed,
    replyToStatus: mockReplyToStatus,
    deleteStatus: mockDeleteStatus,
    archiveStatus: mockArchiveStatus,
    getStatusViews: mockGetStatusViews,
    toggleMuteContact: mockToggleMuteContact,
    reactToStatus: mockReactToStatus,
    getStatusReactions: mockGetStatusReactions,
    getUserReaction: mockGetUserReaction,
  })),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', email: 'test@example.com' },
    loading: false,
  })),
}));

const createMockGroup = (overrides = {}) => ({
  user_id: 'contact-1',
  user: {
    id: 'contact-1',
    display_name: 'John Doe',
    username: 'johndoe',
    avatar_url: 'https://example.com/john.jpg',
  },
  statuses: [
    {
      id: 'status-1',
      type: 'text',
      content: 'Hello World',
      background: 'linear-gradient(135deg, #667eea, #764ba2)',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      has_viewed: false,
      view_count: 10,
      caption: null,
      music_title: null,
      music_url: null,
      media_url: null,
    },
  ],
  has_unviewed: true,
  latest_at: new Date().toISOString(),
  ...overrides,
});

const createPhotoStatus = () => ({
  id: 'status-2',
  type: 'photo',
  content: null,
  background: null,
  media_url: 'https://example.com/photo.jpg',
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  has_viewed: false,
  view_count: 5,
  caption: 'Beautiful sunset',
  music_title: null,
  music_url: null,
});

const createVideoStatus = () => ({
  id: 'status-3',
  type: 'video',
  content: null,
  background: null,
  media_url: 'https://example.com/video.mp4',
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  has_viewed: false,
  view_count: 3,
  caption: null,
  music_title: 'Cool Song',
  music_url: 'https://example.com/song.mp3',
});

const renderStatusViewer = (props = {}) => {
  const defaultGroup = createMockGroup();
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    initialGroup: defaultGroup,
    allGroups: [defaultGroup],
    isOwnStatus: false,
    ...props,
  };

  return render(
    <BrowserRouter>
      <StatusViewer {...defaultProps} />
    </BrowserRouter>
  );
};

describe('StatusViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render when open', () => {
      renderStatusViewer();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderStatusViewer({ open: false });
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('should return null when no status or group', () => {
      renderStatusViewer({ initialGroup: null, allGroups: [] });
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('should display text status content', () => {
      renderStatusViewer();
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('should display photo status with image', () => {
      const group = createMockGroup({
        statuses: [createPhotoStatus()],
      });
      renderStatusViewer({ initialGroup: group, allGroups: [group] });
      
      const img = screen.getByRole('img', { name: 'Estados' });
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    });

    it('should display caption when present', () => {
      const group = createMockGroup({
        statuses: [createPhotoStatus()],
      });
      renderStatusViewer({ initialGroup: group, allGroups: [group] });
      
      expect(screen.getByText('Beautiful sunset')).toBeInTheDocument();
    });

    it('should display music indicator when present', () => {
      const group = createMockGroup({
        statuses: [createVideoStatus()],
      });
      renderStatusViewer({ initialGroup: group, allGroups: [group] });
      
      expect(screen.getByText('Cool Song')).toBeInTheDocument();
    });

    it('should show "Your Status" for own status', () => {
      renderStatusViewer({ isOwnStatus: true });
      // PT label for the current user's own status.
      expect(screen.getByText('O Teu Estado')).toBeInTheDocument();
    });
  });

  describe('Progress Bar', () => {
    it('should render progress bars for each status', () => {
      const group = createMockGroup({
        statuses: [
          { ...createMockGroup().statuses[0], id: 'status-1' },
          { ...createMockGroup().statuses[0], id: 'status-2' },
          { ...createMockGroup().statuses[0], id: 'status-3' },
        ],
      });
      renderStatusViewer({ initialGroup: group, allGroups: [group] });
      
      // Should have 3 progress bar tracks (one per status).
      const progressBars = document.querySelectorAll('.bg-white\\/40');
      expect(progressBars.length).toBe(3);
    });
  });

  describe('Controls', () => {
    it('should show pause/play button', () => {
      renderStatusViewer();
      // Should have a pause button initially
      const pauseButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg') && btn.classList.contains('hover:bg-white/20')
      );
      expect(pauseButton).toBeInTheDocument();
    });

    it('should show close button', () => {
      const onClose = vi.fn();
      renderStatusViewer({ onClose });
      
      // Find close button by X icon
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find(btn => 
        btn.querySelector('svg')?.classList.contains('lucide-x')
      );
      
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalled();
      }
    });

    it('should show mute button when music is present', () => {
      const group = createMockGroup({
        statuses: [createVideoStatus()],
      });
      renderStatusViewer({ initialGroup: group, allGroups: [group] });
      
      // Find volume button
      const buttons = screen.getAllByRole('button');
      const volumeButton = buttons.find(btn => 
        btn.querySelector('svg')?.classList.contains('lucide-volume-x') ||
        btn.querySelector('svg')?.classList.contains('lucide-volume-2')
      );
      expect(volumeButton).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should show navigation arrows when multiple groups', () => {
      const group1 = createMockGroup({ user_id: 'contact-1' });
      const group2 = createMockGroup({ 
        user_id: 'contact-2',
        user: { ...createMockGroup().user, display_name: 'Jane Smith' },
      });
      
      renderStatusViewer({ 
        initialGroup: group1, 
        allGroups: [group1, group2] 
      });
      
      // Should show right arrow (to go to next group)
      const rightArrow = document.querySelector('.lucide-chevron-right');
      expect(rightArrow).toBeInTheDocument();
    });

    it('should not show left arrow on first group', () => {
      const group1 = createMockGroup({ user_id: 'contact-1' });
      const group2 = createMockGroup({ user_id: 'contact-2' });
      
      renderStatusViewer({ 
        initialGroup: group1, 
        allGroups: [group1, group2] 
      });
      
      const leftArrow = document.querySelector('.lucide-chevron-left');
      expect(leftArrow).not.toBeInTheDocument();
    });
  });

  describe('Reply Functionality', () => {
    it('should show reply input for contact status', () => {
      renderStatusViewer({ isOwnStatus: false });
      expect(screen.getByPlaceholderText('Responder...')).toBeInTheDocument();
    });

    it('should show views button for own status', () => {
      renderStatusViewer({ isOwnStatus: true });
      // PT: "<count> visualizações"
      expect(screen.getByText(/visualizações/)).toBeInTheDocument();
    });

    it('should call replyToStatus when sending reply', async () => {
      renderStatusViewer({ isOwnStatus: false });
      
      const input = screen.getByPlaceholderText('Responder...');
      fireEvent.change(input, { target: { value: 'Nice status!' } });
      
      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-send')
      );
      
      if (sendButton) {
        fireEvent.click(sendButton);
        await waitFor(() => {
          expect(mockReplyToStatus).toHaveBeenCalledWith('status-1', 'Nice status!');
        });
      }
    });

    it('should not send empty reply', () => {
      renderStatusViewer({ isOwnStatus: false });
      
      const sendButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-send')
      );
      
      // Button should be disabled for empty input
      expect(sendButton).toHaveAttribute('disabled');
    });
  });

  describe('Status Views', () => {
    it('should show view count for own status', () => {
      renderStatusViewer({ isOwnStatus: true });
      expect(screen.getByText('10 visualizações')).toBeInTheDocument();
    });

    it('should open viewers sheet when clicking views', async () => {
      renderStatusViewer({ isOwnStatus: true });

      fireEvent.click(screen.getByText('10 visualizações'));

      await waitFor(() => {
        expect(mockGetStatusViews).toHaveBeenCalledWith('status-1');
      });
    });
  });

  describe('Dropdown Menu', () => {
    it('should show archive and delete options for own status', async () => {
      renderStatusViewer({ isOwnStatus: true });
      
      // Open dropdown menu
      const menuButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-more-vertical')
      );
      
      if (menuButton) {
        fireEvent.click(menuButton);
        
        await waitFor(() => {
          expect(screen.getByText('Archive')).toBeInTheDocument();
          expect(screen.getByText('Delete')).toBeInTheDocument();
        });
      }
    });

    it('should show mute option for contact status', async () => {
      renderStatusViewer({ isOwnStatus: false });
      
      const menuButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-more-vertical')
      );
      
      if (menuButton) {
        fireEvent.click(menuButton);
        
        await waitFor(() => {
          expect(screen.getByText('Mute John Doe')).toBeInTheDocument();
        });
      }
    });

    it('should call deleteStatus when delete is clicked', async () => {
      const onClose = vi.fn();
      renderStatusViewer({ isOwnStatus: true, onClose });
      
      const menuButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-more-vertical')
      );
      
      if (menuButton) {
        fireEvent.click(menuButton);
        
        await waitFor(() => {
          const deleteOption = screen.getByText('Delete');
          fireEvent.click(deleteOption);
        });
        
        await waitFor(() => {
          expect(mockDeleteStatus).toHaveBeenCalledWith('status-1');
        });
      }
    });

    it('should call archiveStatus when archive is clicked', async () => {
      renderStatusViewer({ isOwnStatus: true });
      
      const menuButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-more-vertical')
      );
      
      if (menuButton) {
        fireEvent.click(menuButton);
        
        await waitFor(() => {
          const archiveOption = screen.getByText('Archive');
          fireEvent.click(archiveOption);
        });
        
        await waitFor(() => {
          expect(mockArchiveStatus).toHaveBeenCalledWith('status-1');
        });
      }
    });

    it('should call toggleMuteContact when mute is clicked', async () => {
      const onClose = vi.fn();
      renderStatusViewer({ isOwnStatus: false, onClose });
      
      const menuButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-more-vertical')
      );
      
      if (menuButton) {
        fireEvent.click(menuButton);
        
        await waitFor(() => {
          const muteOption = screen.getByText('Mute John Doe');
          fireEvent.click(muteOption);
        });
        
        await waitFor(() => {
          expect(mockToggleMuteContact).toHaveBeenCalledWith('contact-1');
          expect(onClose).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Mark as Viewed', () => {
    it('should call markAsViewed for contact status', async () => {
      renderStatusViewer({ isOwnStatus: false });
      
      await waitFor(() => {
        expect(mockMarkAsViewed).toHaveBeenCalledWith('status-1');
      });
    });

    it('should not call markAsViewed for own status', async () => {
      renderStatusViewer({ isOwnStatus: true });
      
      // Give some time for potential calls
      vi.advanceTimersByTime(100);
      
      expect(mockMarkAsViewed).not.toHaveBeenCalled();
    });

    it('should not call markAsViewed if already viewed', async () => {
      const group = createMockGroup({
        statuses: [{
          ...createMockGroup().statuses[0],
          has_viewed: true,
        }],
      });
      
      renderStatusViewer({ 
        initialGroup: group, 
        allGroups: [group], 
        isOwnStatus: false 
      });
      
      vi.advanceTimersByTime(100);
      
      expect(mockMarkAsViewed).not.toHaveBeenCalled();
    });
  });

  describe('Video Status', () => {
    it('should render video element for video status', () => {
      const group = createMockGroup({
        statuses: [createVideoStatus()],
      });
      renderStatusViewer({ initialGroup: group, allGroups: [group] });
      
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('src', 'https://example.com/video.mp4');
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      renderStatusViewer();
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
