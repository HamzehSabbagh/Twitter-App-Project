import * as Linking from "expo-linking";
import { Share } from "react-native";

type ShareableItem = {
  id: number | string;
  type?: "post" | "repost";
  title?: string | null;
  content?: string | null;
  authorName?: string | null;
  username?: string | null;
};

type ShareLabels = {
  appName?: string;
  shareTitle?: string;
  checkOutPost?: string;
  checkOutRepost?: string;
  mediaOnlyPost?: string;
  sharedPostWithoutComment?: string;
  openInApp?: string;
};

function compactWhitespace(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function buildDeepLink(type: ShareableItem["type"], id: ShareableItem["id"]) {
  const pathname = type === "repost" ? `/repost-show/${id}` : `/post/${id}`;
  return Linking.createURL(pathname, { scheme: "hearus" });
}

function buildExcerpt(item: ShareableItem, labels: Required<ShareLabels>) {
  const title = compactWhitespace(item.title);
  const content = compactWhitespace(item.content);

  if (title && content) {
    return `${title}\n\n${content}`;
  }

  if (title) {
    return title;
  }

  if (content) {
    return content;
  }

  return item.type === "repost"
    ? labels.sharedPostWithoutComment
    : labels.mediaOnlyPost;
}

export async function sharePost(item: ShareableItem, customLabels: ShareLabels = {}) {
  const labels: Required<ShareLabels> = {
    appName: customLabels.appName || "HearUs",
    shareTitle: customLabels.shareTitle || "Share post",
    checkOutPost: customLabels.checkOutPost || "Check out this post on HearUs.",
    checkOutRepost: customLabels.checkOutRepost || "Check out this repost on HearUs.",
    mediaOnlyPost: customLabels.mediaOnlyPost || "Media-only post",
    sharedPostWithoutComment: customLabels.sharedPostWithoutComment || "Shared a post",
    openInApp: customLabels.openInApp || "Open in HearUs",
  };

  const deepLink = buildDeepLink(item.type, item.id);
  const authorLine = item.authorName
    ? `${item.authorName}${item.username ? ` (@${item.username})` : ""}`
    : labels.appName;
  const intro = item.type === "repost" ? labels.checkOutRepost : labels.checkOutPost;
  const excerpt = buildExcerpt(item, labels);
  const message = `${intro}\n\n${authorLine}\n\n${excerpt}\n\n${labels.openInApp}: ${deepLink}`;

  return Share.share({
    title: labels.shareTitle,
    message,
  });
}
