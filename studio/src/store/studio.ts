import { create } from "zustand";

export type ContentType = "sosyal" | "ekran" | "robot";
export type ProjectStatus = "draft" | "review" | "final" | "error";
export type PipelineStep =
  | "idle"
  | "script"
  | "voice"
  | "approval"
  | "images"
  | "videos"
  | "edit"
  | "subtitles"
  | "slowdown"
  | "thumbnail"
  | "done"
  | "error";

export interface Scene {
  scene: number;
  text_de: string;
  text_tr?: string;
  voice_direction: string;
  shot_type: string;
  emotion_note: string;
  environment: string;
  molo_pose: string;
}

export interface Project {
  id: string;
  name: string;
  date: string;
  status: ProjectStatus;
  contentType: ContentType;
  lang: string;
  brief: string;
  title?: string;
  scenes: Scene[];
  durations: number[];
  pipelineStep: PipelineStep;
  pipelineProgress: number;
  thumbnailPath?: string;
  finalPath?: string;
  draftPath?: string;
}

interface StudioState {
  projects: Project[];
  activeProjectId: string | null;
  loading: boolean;

  setProjects: (projects: Project[]) => void;
  setActiveProject: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;

  activeProject: () => Project | null;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  loading: false,

  setProjects: (projects) => set({ projects }),
  setActiveProject: (id) => set({ activeProjectId: id }),
  setLoading: (loading) => set({ loading }),

  addProject: (project) =>
    set((s) => ({ projects: [project, ...s.projects] })),

  updateProject: (id, updates) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  removeProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    })),

  activeProject: () => {
    const state = get();
    return state.projects.find((p) => p.id === state.activeProjectId) || null;
  },
}));
