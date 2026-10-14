import { notFound } from "next/navigation";
import { getPostById } from "@/lib/get-post";
import InterceptedReaderModal from "@/components/InterceptedReaderModal";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function InterceptedPostPage(props: Props) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  // Lấy các params bộ lọc
  const filters = {
    q: typeof searchParams.q === "string" ? searchParams.q : undefined,
    tag: typeof searchParams.tag === "string" ? searchParams.tag : undefined,
    artist:
      typeof searchParams.artist === "string" ? searchParams.artist : undefined,
    translator:
      typeof searchParams.translator === "string"
        ? searchParams.translator
        : undefined,
    sort: typeof searchParams.sort === "string" ? searchParams.sort : undefined,
  };

  const result = await getPostById(id, filters);

  if (!result) {
    return notFound();
  }

  return (
    <InterceptedReaderModal
      post={result.post}
      prevId={result.prevId}
      nextId={result.nextId}
    />
  );
}
