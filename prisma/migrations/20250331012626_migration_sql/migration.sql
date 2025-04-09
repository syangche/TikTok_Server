/*
  Warnings:

  - You are about to drop the `hashtags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `video_hashtags` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "video_hashtags" DROP CONSTRAINT "video_hashtags_hashtag_id_fkey";

-- DropForeignKey
ALTER TABLE "video_hashtags" DROP CONSTRAINT "video_hashtags_video_id_fkey";

-- DropTable
DROP TABLE "hashtags";

-- DropTable
DROP TABLE "video_hashtags";
