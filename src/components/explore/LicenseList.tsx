import { Spin, Empty, Tag, Card } from "antd";
import { Link } from "react-router-dom";
import { ParsedLicense, motesToCspr } from "../../hooks/useSampledContract";
import { ISample } from "../../@types/sample";
import { LICENSE_TYPE_INFO, LicenseType } from "../../@types/license";
import { downloadAudio } from "../../util/download-audio";
import { FaDownload } from "react-icons/fa";

interface LicenseListProps {
  licenses: (ParsedLicense & { sample?: ISample })[];
  isLoading: boolean;
}

export const LicenseList = ({ licenses, isLoading }: LicenseListProps) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Spin size="large" />
      </div>
    );
  }

  if (!licenses || licenses.length === 0) {
    return (
      <div className="flex justify-center items-center h-48">
        <Empty
          description={
            <span className="text-gray-400">
              No licenses yet. Purchase a sample to get your first License NFT!
            </span>
          }
        />
      </div>
    );
  }

  const getLicenseTypeInfo = (type: number) => {
    return LICENSE_TYPE_INFO[type as LicenseType] || LICENSE_TYPE_INFO[LicenseType.Personal];
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(Number(timestamp));
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6 pr-4 mt-20">
      {licenses.map((license) => {
        const typeInfo = getLicenseTypeInfo(license.license_type);
        const sample = license.sample;

        return (
          <Card
            key={license.license_id}
            className="!bg-gray-800/50 !border-gray-700 hover:!border-gray-600 transition-all"
            bodyStyle={{ padding: "16px" }}
          >
            {/* Sample cover image */}
            <div className="relative mb-4">
              <img
                src={sample?.cover_image || "/assets/images/default-cover.png"}
                alt={sample?.title || "Sample"}
                className="w-full h-[200px] object-cover rounded-lg"
              />
              <div
                className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium"
                style={{ backgroundColor: typeInfo.color, color: "white" }}
              >
                {typeInfo.name}
              </div>
            </div>

            {/* License info */}
            <div className="space-y-2">
              <h3 className="text-white font-medium truncate">
                {sample?.title || `Sample #${license.sample_id}`}
              </h3>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">License ID:</span>
                <Tag color="blue">#{license.license_id}</Tag>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Price Paid:</span>
                <span className="text-white">
                  {motesToCspr(license.price).toFixed(2)} CSPR
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Purchased:</span>
                <span className="text-gray-300">{formatDate(license.timestamp)}</span>
              </div>

              <p className="text-xs text-gray-500 mt-2">{typeInfo.shortDescription}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              {sample && (
                <>
                  <Link
                    to={`/sample/${sample.sample_id}`}
                    className="flex-1 text-center py-2 px-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
                  >
                    View Sample
                  </Link>
                  <button
                    onClick={() => downloadAudio(sample.ipfs_link, `${sample.title}.mp3`)}
                    className="py-2 px-3 bg-primary hover:bg-primary/80 rounded-lg text-sm text-black transition-colors flex items-center gap-2"
                  >
                    <FaDownload size={12} />
                    Download
                  </button>
                </>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
