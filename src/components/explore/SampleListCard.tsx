import { Avatar } from "antd";
import { TbPlayerPlayFilled } from "react-icons/tb";
import { Link } from "react-router-dom";
import { ISample } from "../../@types/sample"
import { truncateString } from "../../util/string-helpers";
import { octasToMove } from "../../hooks/useSampledContract";

interface propsI {
  sample: ISample;
  index: number;
}

export const SampleListCard = ({ sample, index }: propsI) => {
  return (
    <div className="bg-grey-800 hover:bg-grey-1000 p-3 md:px-6 md:py-[10px] rounded-lg flex items-center gap-2 border-[1px] border-white/5">
      <p className="h-full hidden items-center md:flex">{index}.</p>
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-3">
          <div>
            <img
              alt=""
              src={sample?.cover_image || "/assets/images/vr_guy.jpg"}
              className="rounded-lg object-cover h-[55px] w-[55px]"
            />
          </div>
          <div>
            <p className="md:text-lg font-semibold">{sample?.title}</p>
            <p className="text-sm">{truncateString(sample?.seller)}</p>
          </div>
        </div>
        <p className="text-sm md:block hidden">{sample?.total_sales} Sales</p>
        <div className="flex gap-2 items-center">
          <Avatar src={"/assets/images/casper-logo.png"} size={20} />
          <p className="text-sm">{octasToMove(sample?.price)} MOVE</p>
        </div>
        <Link to={`/sample/${sample?.sample_id}`}>
          <div className="md:h-[44px] h-[35px] md:w-[44px] w-[35px] rounded-full bg-primary-default flex items-center justify-center cursor-pointer">
            <TbPlayerPlayFilled size={20} />
          </div>
        </Link>
      </div>
    </div>
  );
};
