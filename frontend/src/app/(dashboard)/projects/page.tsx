import type { Metadata } from "next";
import { ProjectsView } from "@/components/projects/ProjectsView";

export const metadata: Metadata = { title: "My projects" };

export default function ProjectsPage() {
  return <ProjectsView />;
}
