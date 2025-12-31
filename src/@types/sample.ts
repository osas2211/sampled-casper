export interface IUploadSamplePayload {
  seller: string
  price: bigint
  ipfs_link: string
  title: string
  bpm: number
  genre: string
  cover_image: string
  video_preview_link: string
}

export interface ISample {
  bpm: string
  created_at: string
  genre: string
  ipfs_link: string
  is_active: boolean
  price: string
  sample_id: string
  seller: string
  title: string
  total_sales: string
  cover_image: string
  video_preview_link: string
}
