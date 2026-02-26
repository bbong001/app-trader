/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react'
import { FormEvent, useContext, useEffect, useRef, KeyboardEvent } from 'react'
import { AppContext } from '~/contexts/app.context'
import logo from '~/assets/images/logo.png'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { createMessage, getMessages, uploadImage, uploadImageCloudinary } from '~/apis/message.api'
import io from 'socket.io-client'
import { generateRandomOrderCode } from '~/utils/utils'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import { getCFMess } from '~/apis/auth.api'
import Compressor from 'compressorjs'
import sender from '~/assets/images/chat.jpg'

// Icon người gửi và người nhận
const SenderIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    fill='none'
    viewBox='0 0 24 24'
    stroke='currentColor'
    className='w-6 h-6 text-blue-500'
  >
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
  </svg>
)



const Support = () => {
  const serverUrl = 'https://socket.amzorders.net'
  const [valueInput, setValueInput] = useState<string>('') // Input của người dùng
  const { profile, isAuthenticated } = useContext(AppContext)
  const [contentMessage, setContentMessage] = useState<any>([])
  const [contentMessageNew, setContentMessageNew] = useState<any>([])// Danh sách tin nhắn
  const [selectedImage, setSelectedImage] = useState<string | null>(null) // State cho ảnh được phóng to
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient()
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const socketRef = useRef<any>(null)

  const limit = 10 // Số lượng tin nhắn lấy mỗi lần
  const [skip, setSkip] = useState(0) // Bắt đầu từ tin nhắn mới nhất
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  // Tự động cuộn xuống khi có tin nhắn mới
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }
  useQuery({
    queryKey: ['getCFMess', profile?._id],
    queryFn: () => getCFMess(), // Giới hạn ban đầu
    onSuccess: (data) => {
      console.log(data.data[0].content);
      setContentMessageNew(data.data)

      // Cuộn xuống dưới khi load xong
    }
  })
  // Lấy tin nhắn ban đầu
  const { refetch } = useQuery({
    queryKey: ['message', profile?._id],
    queryFn: () => getMessages(10, 0, 'admin@admin.com'), // Giới hạn ban đầu
    onSuccess: (data) => {
      setContentMessage(data.data.getMessage.content)
      scrollToBottom() // Cuộn xuống dưới khi load xong
    }
  })

  // Thiết lập socket để nhận tin nhắn mới từ server
  useEffect(() => {
    socketRef.current = io(serverUrl)
    socketRef.current.on('receiveMessUser', (newMessage: any) => {
      refetch()
      queryClient.invalidateQueries({ queryKey: ['message', profile?._id] })
      setContentMessage((prevMessages: any) => [...prevMessages, newMessage])
      scrollToBottom()
    })

    return () => {
      socketRef.current.disconnect()
    }
  }, [queryClient, refetch, profile?._id])

  // Gửi tin nhắn
  const chatMutation = useMutation({
    mutationFn: (body: any) => createMessage(body),
    onSuccess: () => {
      queryClient.invalidateQueries(['message', profile?._id]) // Cập nhật tin nhắn
      scrollToBottom()
      socketRef.current.emit('sendMessUser')
    }
  })

  const handleSubmit = (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault()
    if (valueInput !== '') {
      const data = {
        message: valueInput,
        sender: profile?._id,
        receiver: 'admin@admin.com'
      }

      const newMessage = {
        _id: generateRandomOrderCode(10),
        userId: profile?._id,
        message: valueInput,
        createdAt: new Date()
      }
      setContentMessage((prevContent: any[]) => [...prevContent, newMessage])
      setValueInput('')
      chatMutation.mutate(data)
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const mutationChangeAvatar = useMutation((formData: FormData) => uploadImage(formData), {
    onSuccess: () => {
      queryClient.invalidateQueries(['message', profile?._id])
      socketRef.current.emit('sendMessUser')
    },
    onError: () => {
      toast.error('Up ảnh thất bại!')
    }
  })
  const mutationChangeAvatarCloudinary = useMutation((body: { sender: any; receiver: string; image: string }) => uploadImageCloudinary(body), {
    onSuccess: () => {
      queryClient.invalidateQueries(['message', profile?._id])
      socketRef.current.emit('sendMessUser')
    },
    onError: () => {
      toast.error('Up ảnh thất bại!')
    }
  })

  const handleAvatar = async (e: any) => {
    const file = e.target.files[0];
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Chỉ chấp nhận file JPEG, PNG, hoặc WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast.error('Dung lượng file quá lớn, vui lòng chọn file nhỏ hơn 5MB.');
      return;
    }

    // Đổi tên file để đảm bảo tên ngắn gọn
    const renamedFile = new File([file], "mess." + file.type.split('/')[1], {
      type: file.type,
      lastModified: file.lastModified
    });
    setIsUploading(true);

    new Compressor(renamedFile, {
      quality: 0.7,
      maxWidth: 1920,
      success: async (compressedFile: any) => {
        const formData = new FormData();
        formData.append('url', compressedFile);
        formData.append('sender', profile?._id);
        formData.append('receiver', 'admin@admin.com');

        try {
          // Thử upload qua server trước
          await mutationChangeAvatar.mutateAsync(formData);
          toast.success('Upload ảnh thành công!');
        } catch (error) {
          // Nếu upload server thất bại, thử upload qua Cloudinary
          try {
            const cloudinaryFormData = new FormData();
            cloudinaryFormData.append('file', compressedFile);
            cloudinaryFormData.append('upload_preset', 'glory365');
            cloudinaryFormData.append('folder', 'api-glory365');

            const response = await fetch(
              `https://api.cloudinary.com/v1_1/dbsy0kyh5/image/upload`,
              {
                method: 'POST',
                body: cloudinaryFormData
              }
            );

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.message || 'Upload failed');
            }

            // Tạo message với URL ảnh từ Cloudinary

            //truyền dạng body
            const body = {
              sender: profile?._id,
              receiver: 'admin@admin.com',
              image: data.secure_url
            };

            await mutationChangeAvatarCloudinary.mutateAsync(body);
            const socket = io(serverUrl);
            await queryClient.invalidateQueries(['message', profile?._id]);
            socket.emit('sendMessImageUser');
            socket.emit('sendMessUser');
            toast.success('Upload ảnh thành công!');
          } catch (cloudinaryError) {
            toast.error('Upload ảnh thất bại!');
            console.error(cloudinaryError);
          }
        } finally {
          setIsUploading(false);
          e.target.value = '';
        }
      },
      error: () => {
        toast.error('Nén ảnh thất bại!');
        setIsUploading(false);
      }
    });
  };

  const handleTestCloudinaryUpload = async (e: any) => {
    const file = e.target.files[0];
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Chỉ chấp nhận file JPEG, PNG, hoặc WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dung lượng file quá lớn, vui lòng chọn file nhỏ hơn 5MB.');
      return;
    }

    setIsUploading(true);

    try {
      const cloudinaryFormData = new FormData();
      cloudinaryFormData.append('file', file);
      cloudinaryFormData.append('upload_preset', 'glory365');
      cloudinaryFormData.append('folder', 'api-glory365');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/dbsy0kyh5/image/upload`,
        {
          method: 'POST',
          body: cloudinaryFormData
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      console.log('Upload thành công! URL:', data.secure_url);

      // Gửi URL lên server
      const body = {
        sender: profile?._id,
        receiver: 'admin@admin.com',
        image: data.secure_url
      };

      await mutationChangeAvatarCloudinary.mutateAsync(body);
      toast.success('Upload và lưu ảnh thành công!');

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload ảnh thất bại!');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleImageClick = (imageSrc: string) => {
    setSelectedImage(imageSrc) // Mở ảnh phóng to
  }

  const closeModal = () => {
    setSelectedImage(null) // Đóng ảnh phóng to
  }
  const navigate = useNavigate()
  if (!isAuthenticated) {
    navigate('/signin')
  }
  const fetchMoreMessages = async () => {
    const newSkip = skip + limit
    const response = await getMessages(limit, newSkip, 'admin@admin.com')
    if (response.data.getMessage.content.length > 0) {
      setContentMessage((prevMessages: any) => [...prevMessages, ...response.data.getMessage.content])
      setSkip(newSkip)
    } else {
      setHasMoreMessages(false)
    }
  }

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      if (messagesContainerRef.current.scrollTop === 0 && hasMoreMessages) {
        fetchMoreMessages()
      }
    }
  }

  const getImageUrl = (image: string) => {
    if (image.startsWith('https://res.cloudinary.com')) {
      return image;
    }
    return `https://api.amzorders.net/${image}`;
  }

  return (
    <div className='w-full h-[550px] transition rounded-2xl overflow-hidden duration-300 shadow-2xl mb-4 bg-primary'>
      <div className='px-4 py-1.5 text-white'>
        <div className='flex justify-between items-center mb-2'>
          <div>
            <img src={logo} alt='logo' className='w-[80px] inline-block h-[30px] mx-auto rounded-md' />
            <p className='inline-block translate-y-0.5 mx-2'>Hello,</p>
            <div className='inline-block translate-y-0.5 font-[700]'>{profile?.name}</div>
          </div>
        </div>
      </div>
      <div
        onScroll={handleScroll}
        ref={messagesContainerRef}
        className='w-auto h-[430px] bg-white p-3 overflow-y-scroll custom-scrollbar flex flex-col-reverse'
      >
        {contentMessage.map((item: any) => (
          <div
            key={item._id}
            className={`chat-message mb-3 flex ${item.userId === profile._id ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className='w-6 h-6 mt-1'>{item.userId === profile._id ? <SenderIcon /> : <img src={sender} alt="" />}</div>
            <div className={`flex flex-col space-y-2 text-xs mx-2 items-start`}>
              {item?.message !== '' ? (
                <span
                  className={`px-3 py-2 rounded-lg inline-block max-w-xs break-words flex ${item.userId === profile._id
                    ? 'bg-blue-500 text-white justify-start'
                    : 'bg-gray-300 text-black self-start'
                    }`}
                >
                  {item.message}
                </span>
              ) : (
                <img
                  className={`px-1 py-1 rounded-lg inline-block ${item.userId === profile._id ? 'self-end' : 'self-start'
                    }`}
                  src={item.image && item.image.length > 0 ? getImageUrl(item.image[0]) : ''}
                  alt='Message Image'
                  style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'cover' }}
                  onClick={() => handleImageClick(item.image && item.image.length > 0 ? getImageUrl(item.image[0]) : '')}
                />
              )}
            </div>
          </div>
        ))}
        {contentMessage.length < 1 && contentMessageNew.map((item: any) => (
          <div
            key={item._id}
            className={`chat-message mb-3 flex ${item.userId === profile._id ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className='w-10 h-10 mt-1'>{item.userId === profile._id ? <SenderIcon /> : <img src={sender} alt="" />}</div>
            <div className={`flex flex-col space-y-2 text-xs mx-2 items-start`}>
              {item?.content !== '' ? (
                <span
                  className={`px-3 py-2 rounded-lg inline-block max-w-xs break-words flex ${item.userId === profile._id
                    ? 'bg-blue-500 text-white justify-start'
                    : 'bg-gray-300 text-black self-start'
                    }`}
                >
                  {item.content.split("\n").map((line: any, index: any) => (
                    <React.Fragment key={index}>
                      {line} <br />
                    </React.Fragment>
                  ))}
                </span>

              ) : (
                <img
                  className={`px-1 py-1 rounded-lg inline-block ${item.userId === profile._id ? 'self-end' : 'self-start'
                    }`}
                  src={item.image && item.image.length > 0 ? getImageUrl(item.image[0]) : ''}
                  alt='Message Image'
                  style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'cover' }}
                  onClick={() => handleImageClick(item.image && item.image.length > 0 ? getImageUrl(item.image[0]) : '')}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className='w-auto border-t h-[50px] bg-white shadow flex px-3 overflow-hidden'>
        <label htmlFor='dropzone-file' className='w-14 flex items-center justify-center cursor-pointer'>
          <input id='dropzone-file' type='file' accept='image/*' className='hidden' onChange={handleTestCloudinaryUpload} />
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24' className='text-gray-500'>
            <path
              fill='currentColor'
              d='M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zM5 18v-1.764l2.588-2.963c.5-.573 1.355-.6 1.89-.056L13 16.5 9 21H5zm14-3l-2.55 3.06c-.52.628-1.445.7-2.03.17l-4.65-4.16L5 18v-2.764L7.53 12.5c.93-1.07 2.565-1.07 3.49 0L14 15l1.95-2.34c.93-1.12 2.565-1.12 3.49 0L19 15v3zm-7-10a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'
            />
          </svg>
        </label>
        {/* <label htmlFor='test-cloudinary' className='w-14 flex items-center justify-center cursor-pointer'>
          <input 
            id='test-cloudinary' 
            type='file' 
            accept='image/*' 
            className='hidden' 
            onChange={handleTestCloudinaryUpload}
          />
          <span className="text-sm text-gray-500">Test Cloudinary</span>
        </label> */}
        <textarea
          value={valueInput}
          onChange={(e) => setValueInput(e.target.value)}
          onKeyDown={handleKeyPress}
          className='w-full h-full p-2 text-sm overflow-auto rounded-md resize-none'
          placeholder='Vui lòng nhập'
        />
        <button type='submit' className='w-14 flex items-center justify-center'>
          <svg viewBox='0 0 22 22' width='30' height='30' className='fill-primary'>
            <path
              d='M2.0300068,0.145970044 L20.9662955,9.37015518 C22.3445682,10.0420071 22.3445682,11.9582654 20.9662955,12.6296618 L2.0300068,21.853847 C1.09728834,22.3084288 0,21.6475087 0,20.6317597 L0.806953417,13.8945654 C0.882225434,13.2659853 1.39089595,12.7699536 2.03608467,12.6957083 L12.0229514,11.6795038 C12.8612292,11.5943266 12.8612292,10.4054904 12.0229514,10.3203132 L2.03608467,9.30410872 C1.39089595,9.23031889 0.882225434,8.7342872 0.806953417,8.10525162 L0,1.36805729 C0,0.352308292 1.09728834,-0.3081563 2.0300068,0.145970044'
              fill='currentColor'
            />
          </svg>
        </button>
      </form>

      {/* Modal hiển thị ảnh lớn */}
      {selectedImage && (
        <div
          className='fixed top-0 left-0 w-full h-full bg-black bg-opacity-75 flex items-center justify-center'
          onClick={closeModal}
        >
          <img src={selectedImage} alt='Zoomed Image' className='w-96 h-auto' />
        </div>
      )}
      {isUploading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="loader"></div>
        </div>
      )}
    </div>
  )
}

export default Support
