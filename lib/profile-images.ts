import { ImageSourcePropType } from "react-native";

const defaultProfileImage = require("../assets/images/default-profile.png");

export function getProfileImageSource(imageUrl?: string | null): ImageSourcePropType {
  if (imageUrl) {
    return { uri: imageUrl };
  }

  return defaultProfileImage;
}

export function getCoverImageSource(
  coverUrl?: string | null,
  imageUrl?: string | null
): ImageSourcePropType {
  if (coverUrl) {
    return { uri: coverUrl };
  }

  if (imageUrl) {
    return { uri: imageUrl };
  }

  return defaultProfileImage;
}

export function getCoverResizeMode(coverUrl?: string | null) {
  return coverUrl ? "cover" : "contain";
}
