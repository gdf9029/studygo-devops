export default function GetAvgRating(ratingArr) {
  if (!Array.isArray(ratingArr) || ratingArr.length === 0) {
    return 0
  }
  const totalReviewCount = ratingArr.reduce((acc, curr) => {
    const ratingValue = Number(curr?.rating) || 0
    return acc + ratingValue
  }, 0)

  const multiplier = Math.pow(10, 1)
  const avgReviewCount =
    Math.round((totalReviewCount / ratingArr.length) * multiplier) / multiplier

  return avgReviewCount
}
