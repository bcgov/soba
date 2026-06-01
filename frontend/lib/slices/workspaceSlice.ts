import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { fetchWorkspaces, WorkspaceItem } from '@/src/shared/api/sobaApi';

export interface WorkspaceState {
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: WorkspaceState = {
  workspaces: [],
  activeWorkspaceId: null,
  status: 'idle',
  error: null,
};

export const loadWorkspaces = createAsyncThunk(
  'workspace/loadWorkspaces',
  async (token: string, { rejectWithValue }) => {
    try {
      const response = await fetchWorkspaces(token);
      return response.items;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to load workspaces');
    }
  }
);

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setActiveWorkspaceId(state, action: PayloadAction<string>) {
      state.activeWorkspaceId = action.payload;
    },
    clearWorkspaceState(state) {
      state.workspaces = [];
      state.activeWorkspaceId = null;
      state.status = 'idle';
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadWorkspaces.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadWorkspaces.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.workspaces = action.payload;
        
        // Auto-select a workspace if none is active
        if (!state.activeWorkspaceId && state.workspaces.length > 0) {
          // Prefer personal workspace
          const personalWorkspace = state.workspaces.find((w) => w.kind === 'personal');
          if (personalWorkspace) {
            state.activeWorkspaceId = personalWorkspace.id;
          } else {
            // Fallback to the first available workspace
            state.activeWorkspaceId = state.workspaces[0].id;
          }
        }
      })
      .addCase(loadWorkspaces.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      });
  },
});

export const { setActiveWorkspaceId, clearWorkspaceState } = workspaceSlice.actions;
export default workspaceSlice.reducer;
