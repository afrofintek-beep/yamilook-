import React from 'react';
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import FileApplicationPicker from '../../src/components/sharing/FileApplicationPicker';
import { sharePreparedVideo } from '../../shared/post-video-sharing.mjs';

// A prepared file is already present before the user's tap, as in the export dialog.
const file = new File(['test-payload'], 'video-yamilook.mp4', { type: 'video/mp4' });
createRoot(document.getElementById('root')!).render(<FileApplicationPicker onShare={() => { void sharePreparedVideo(file); }} />);
