import { create } from "zustand";

// ── Content & Status Types ──
export type ContentType = "sosyal" | "ekran" | "robot" | "greenscreen" | "greenscreen-yatay" | "greenscreen-kare";
export type ProjectStatus = "draft" | "review" | "final" | "error";
export type PipelineStep =
  | "idle"
  | "script"
  | "images"
  | "image_review"
  | "voice"
  | "done"
  | "error";

export type FrameRole = "first" | "last" | "auto";
export type ShotType = "wide" | "medium" | "medium-close" | "close";

// ── Image Variant ──
export interface SceneImageVariant {
  id: string;           // e.g. "scene_01_v1"
  url: string;          // API file URL
  selected: boolean;
  score?: number;       // QC score (1-10)
}

// ── Scene ──
export interface Scene {
  scene: number;
  text_de: string;
  text_tr?: string;
  voice_direction: string;
  shot_type: ShotType | string;
  emotion_note: string;
  environment: string;
  background_description?: string;
  molo_pose: string;
  // Image approval fields
  withMolo: boolean;
  imageVariants: SceneImageVariant[];
  selectedImageId: string | null;
  frameRole: FrameRole;
}

// ── Image Approval ──
export interface SceneApproval {
  selectedVariant: string;
  frameRole: FrameRole;
  withMolo: boolean;
}

// ── Project ──
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
  approval?: Record<number, SceneApproval>;
  pipelineStep: PipelineStep;
  pipelineProgress: number;
  thumbnailPath?: string;
}

// ── Store ──
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

  // Scene-level actions
  updateScene: (projectId: string, sceneNumber: number, updates: Partial<Scene>) => void;
  selectVariant: (projectId: string, sceneNumber: number, variantId: string) => void;
  setFrameRole: (projectId: string, sceneNumber: number, role: FrameRole) => void;
  toggleMolo: (projectId: string, sceneNumber: number) => void;
  approveAllImages: (projectId: string) => Record<number, SceneApproval> | null;

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

  // Update a single scene within a project
  updateScene: (projectId, sceneNumber, updates) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              scenes: p.scenes.map((sc) =>
                sc.scene === sceneNumber ? { ...sc, ...updates } : sc
              ),
            }
          : p
      ),
    })),

  // Select a specific image variant for a scene
  selectVariant: (projectId, sceneNumber, variantId) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              scenes: p.scenes.map((sc) =>
                sc.scene === sceneNumber
                  ? {
                      ...sc,
                      selectedImageId: variantId,
                      imageVariants: sc.imageVariants.map((v) => ({
                        ...v,
                        selected: v.id === variantId,
                      })),
                    }
                  : sc
              ),
            }
          : p
      ),
    })),

  // Set frame role for a scene
  setFrameRole: (projectId, sceneNumber, role) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              scenes: p.scenes.map((sc) =>
                sc.scene === sceneNumber ? { ...sc, frameRole: role } : sc
              ),
            }
          : p
      ),
    })),

  // Toggle Molo on/off for a scene
  toggleMolo: (projectId, sceneNumber) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              scenes: p.scenes.map((sc) =>
                sc.scene === sceneNumber
                  ? { ...sc, withMolo: !sc.withMolo }
                  : sc
              ),
            }
          : p
      ),
    })),

  // Collect all scene approvals — returns null if any scene lacks a selection
  approveAllImages: (projectId) => {
    const state = get();
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return null;

    const approval: Record<number, SceneApproval> = {};
    for (const sc of project.scenes) {
      if (!sc.selectedImageId && sc.imageVariants.length > 0) return null;
      approval[sc.scene] = {
        selectedVariant: sc.selectedImageId || sc.imageVariants[0]?.id || "",
        frameRole: sc.frameRole,
        withMolo: sc.withMolo,
      };
    }
    return approval;
  },

  activeProject: () => {
    const state = get();
    return state.projects.find((p) => p.id === state.activeProjectId) || null;
  },
}));
