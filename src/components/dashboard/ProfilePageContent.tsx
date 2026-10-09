/**
 * @file ProfilePageContent.tsx
 * @description 个人主页内容区：左侧用户资料卡（头像、昵称、认证标识、简介、标签、位置/网站/加入时间/角色、社交链接、统计、操作按钮）+ 右侧 ProfileTabs
 * @usage 服务端组件（无交互状态）；社交链接支持填用户名或完整 URL，自动补全协议前缀；文案取自 messages.profile
 */
import { MapPin, Globe, Calendar, Users, Check, PenLine, UserPen } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatsGrid } from "@/components/ui/StatsGrid";
import { getInitials, joinName, formatCount, formatDate } from "@shared/format";
import { messages } from "@/texts";
import type { Post, User } from "@shared";
import { ProfileTabs } from "./ProfileTabs";

/**
 * Twitter/X 品牌图标（内联 SVG，避免额外图标依赖）
 * @returns 16x16 的 Twitter 图标节点
 */
function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/**
 * GitHub 品牌图标（内联 SVG）
 * @returns 16x16 的 GitHub 图标节点
 */
function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
      <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.73.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.4-1.27.73-1.56-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.53 11.53 0 0 0 23.5 12C23.5 5.74 18.27.5 12 .5z" />
    </svg>
  );
}

/**
 * LinkedIn 品牌图标（内联 SVG）
 * @returns 16x16 的 LinkedIn 图标节点
 */
function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/** 资料卡元信息行图标统一样式类 */
const META_ICON = "size-3.5 text-faint";

/**
 * 个人主页内容区
 * @param props.user 用户资料
 * @param props.published 已发布文章列表
 * @param props.favorites 收藏文章列表
 * @param props.drafts 草稿列表
 * @returns 左资料卡 + 右标签页的双列布局
 */
export function ProfilePageContent({
  user,
  published,
  favorites,
  drafts,
}: {
  /** 用户资料 */
  user: User;

  /** 已发布文章列表 */
  published: Post[];

  /** 收藏文章列表 */
  favorites: Post[];

  /** 草稿列表 */
  drafts: Post[];
}) {
  /** 由姓名首字母拼出的头像占位字符 */
  const userInitials = getInitials(user.firstName, user.lastName);

  /** 拼接后的完整显示名 */
  const userName = joinName(user.firstName, user.lastName);

  /** 统计网格数据项（文章/获赞/浏览） */
  const stats = [
    { label: messages.profile.statsArticles, value: formatCount(user.stats?.articles ?? 0) },
    { label: messages.profile.statsLikes, value: formatCount(user.stats?.likes ?? 0) },
    { label: messages.profile.statsViews, value: formatCount(user.stats?.views ?? 0) },
  ];

  /** Twitter 链接：已是 URL 直接用，否则按用户名拼接站点前缀 */
  const socialTwitter = user.social?.twitter
    ? user.social.twitter.startsWith("http")
      ? user.social.twitter
      : `https://twitter.com/${user.social.twitter.replace("@", "")}`
    : undefined;

  /** GitHub 链接（同上规则） */
  const socialGithub = user.social?.github
    ? user.social.github.startsWith("http")
      ? user.social.github
      : `https://github.com/${user.social.github}`
    : undefined;

  /** LinkedIn 链接（同上规则） */
  const socialLinkedin = user.social?.linkedin
    ? user.social.linkedin.startsWith("http")
      ? user.social.linkedin
      : `https://linkedin.com/in/${user.social.linkedin}`
    : undefined;

  /** 是否配置了任意社交链接，决定是否渲染社交图标区 */
  const hasSocial = !!(socialTwitter || socialGithub || socialLinkedin);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr] lg:gap-12">
      {/* 左侧粘性用户资料卡 */}
      <aside className="animate-fade-in">
        <div className="sticky-below-nav max-lg:static">
          <section className="overflow-hidden card shadow-(--shadow-sm)">
            {/* 封面色带 */}
            <div className="h-24 w-full profile-cover-band" />
            <div className="px-6 pb-7">
              {/* 头像（重叠于色带下方） */}
              <div className="-mt-5">
                <Avatar
                  size="lg"
                  src={user.avatar || undefined}
                  alt={userName}
                  initials={userInitials}
                  className="border-4 border-card-bg"
                />
              </div>

              {/* 昵称 + 认证标识 + 用户名 */}
              <div className="mt-5">
                <div className="row-sm flex-wrap">
                  <h1 className="m-0 text-(length:--type-md) leading-tight font-bold tracking-[-0.02em] text-heading">
                    {userName}
                  </h1>

                  {user.verified && (
                    <span
                      role="img"
                      aria-label={messages.profile.verified}
                      title={messages.profile.verified}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent text-page"
                    >
                      <Check size={10} strokeWidth={2.5} />
                    </span>
                  )}
                </div>
                <p className="m-0 mt-1 meta-text">@{user.username}</p>
              </div>

              {/* 个人简介（无则展示占位文案） */}
              <p className="mt-4 text-(length:--type-xs) leading-relaxed text-body">
                {user.bio || messages.profile.noBio}
              </p>

              {/* 用户标签组 */}
              {user.tags?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {user.tags.map((tag) => (
                    <span key={tag} className="chip-outline">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 位置/网站/加入时间/角色等元信息，缺失项不渲染 */}
              <div className="mt-5 space-y-2 text-(length:--type-2xs) leading-normal text-body">
                {user.location && (
                  <span className="row-sm">
                    <MapPin className={META_ICON} strokeWidth={2.5} />
                    {user.location}
                  </span>
                )}
                {user.website && (
                  <a
                    href={
                      user.website.startsWith("http") ? user.website : `https://${user.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="row-sm transition-colors hover:text-heading"
                  >
                    <Globe className={META_ICON} strokeWidth={2.5} />
                    {user.website}
                  </a>
                )}
                {user.joined && (
                  <span className="row-sm">
                    <Calendar className={META_ICON} strokeWidth={2.5} />
                    {formatDate(user.joined)}
                  </span>
                )}
                <span className="row-sm">
                  <Users className={META_ICON} strokeWidth={2.5} />

                  {user.role === "Writer" ? messages.profile.roleWriter : user.role}
                  {user.company ? ` · ${user.company}` : ""}
                </span>
              </div>

              {/* 社交链接图标区（仅在配置了社交链接时渲染） */}
              {hasSocial && (
                <div className="mt-5 row-sm">
                  {socialTwitter && (
                    <a
                      href={socialTwitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Twitter"
                      className="icon-btn"
                    >
                      <TwitterIcon />
                    </a>
                  )}
                  {socialGithub && (
                    <a
                      href={socialGithub}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="GitHub"
                      className="icon-btn"
                    >
                      <GithubIcon />
                    </a>
                  )}
                  {socialLinkedin && (
                    <a
                      href={socialLinkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="LinkedIn"
                      className="icon-btn"
                    >
                      <LinkedinIcon />
                    </a>
                  )}
                </div>
              )}

              {/* 统计网格 */}
              <div className="mt-6 border-t border-stroke pt-6">
                <StatsGrid items={stats} />
              </div>

              {/* 操作按钮：撰写文章 / 编辑资料 */}
              <div className="mt-6 row-md">
                <Button href="/write" size="md" className="flex-1">
                  <PenLine size={16} strokeWidth={2.5} />
                  {messages.profile.writeArticle}
                </Button>
                <Button href="/settings" variant="outline" size="md" className="flex-1">
                  <UserPen size={16} strokeWidth={2.5} />
                  {messages.profile.editProfile}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </aside>

      {/* 右侧文章/草稿/收藏标签页 */}
      <ProfileTabs published={published} favorites={favorites} drafts={drafts} />
    </div>
  );
}
